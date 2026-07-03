import { type FilterQuery, LockMode, OptimisticLockError } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { TeamspaceEntity } from '~/modules/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { AuditService } from '~/modules/shared/audit/audit.service';
import { assertWorkspaceEditor } from '../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../workspace/app/workspace.repository';
import { DocumentEntity } from '../infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentVisitEntity } from '../infra/persistence/entities/document-visit.entity';
import {
  DEFAULT_CONTENT_FORMAT,
  DEFAULT_DOCUMENT_CONTENT,
  DEFAULT_DOCUMENT_TITLE,
  SORT_STEP,
} from './document-defaults';
import { extractDocumentSearchText } from './document-search-text';
import type {
  CreateDocumentInput,
  DocumentSummary,
  DocumentNavigationNode,
  DocumentNavigationPage,
  DocumentTreeChild,
  ListWorkspaceDocumentsInput,
  MoveDocumentInput,
  UpdateDocumentInput,
  WorkspaceDocumentNavigation,
} from './document.types';

const SUBDOC_BLOCK_TYPE = 'subpage';

@Injectable()
export class DocumentService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
  ) {}

  async listForWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: ListWorkspaceDocumentsInput,
  ): Promise<WorkspaceDocumentNavigation | DocumentNavigationPage> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    const entityManager = this.entityManager.fork();

    if (input.parentDocumentId) {
      const parentDocument = await this.findDocumentOrThrow(input.parentDocumentId, entityManager);

      if (parentDocument.workspace.id !== workspace.id) {
        throw new NotFoundException(`Document ${input.parentDocumentId} was not found.`);
      }

      return this.listDocumentNavigationPage(workspace.id, entityManager, {
        parentDocumentId: input.parentDocumentId,
        limit: input.limit,
        cursor: input.cursor,
        query: input.query,
      });
    }

    const teamspaces = await entityManager.find(TeamspaceEntity, {
      workspace: workspace.id,
    }, {
      orderBy: {
        name: 'asc',
      },
    });

    const [privateDocuments, teamspaceDocuments] = await Promise.all([
      this.listDocumentNavigationPage(workspace.id, entityManager, {
        teamspaceId: null,
        parentDocumentId: null,
        limit: input.limit,
        cursor: input.cursor,
        query: input.query,
      }),
      Promise.all(teamspaces.map(async (teamspace) => ({
        id: teamspace.id,
        name: teamspace.name,
        description: teamspace.description,
        documents: await this.listDocumentNavigationPage(workspace.id, entityManager, {
          teamspaceId: teamspace.id,
          parentDocumentId: null,
          limit: input.limit,
          cursor: input.cursor,
          query: input.query,
        }),
      }))),
    ]);

    return {
      privateDocuments,
      teamspaces: teamspaceDocuments,
    };
  }

  async getDefaultDocumentForWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    recentDocumentId?: string,
  ): Promise<{ documentId?: string }> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    const entityManager = this.entityManager.fork();

    if (recentDocumentId) {
      const recentDocument = await entityManager.findOne(DocumentEntity, {
        id: recentDocumentId,
        workspace: workspace.id,
        archivedAt: null,
      });

      if (recentDocument) {
        return { documentId: recentDocument.id };
      }
    }

    const recentVisit = await entityManager.findOne(DocumentVisitEntity, {
      workspace: workspace.id,
      user: currentUser.userId,
      document: {
        archivedAt: null,
      },
    }, {
      populate: ['document'],
      orderBy: {
        lastVisitedAt: 'desc',
      },
    });

    if (recentVisit?.document) {
      return { documentId: recentVisit.document.id };
    }

    const firstPrivateRoot = await entityManager.findOne(DocumentEntity, {
      workspace: workspace.id,
      teamspace: null,
      parentDocument: null,
      archivedAt: null,
    }, {
      orderBy: {
        sortKey: 'asc',
        createdAt: 'asc',
      },
    });

    if (firstPrivateRoot) {
      return { documentId: firstPrivateRoot.id };
    }

    const teamspaces = await entityManager.find(TeamspaceEntity, {
      workspace: workspace.id,
    }, {
      orderBy: {
        name: 'asc',
      },
    });

    for (const teamspace of teamspaces) {
      const firstTeamspaceRoot = await entityManager.findOne(DocumentEntity, {
        workspace: workspace.id,
        teamspace: teamspace.id,
        parentDocument: null,
        archivedAt: null,
      }, {
        orderBy: {
          sortKey: 'asc',
          createdAt: 'asc',
        },
      });

      if (firstTeamspaceRoot) {
        return { documentId: firstTeamspaceRoot.id };
      }
    }

    return {};
  }

  async getForUser(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);

    await this.resolveWorkspaceForUser(document.workspace.id, currentUser);
    await this.recordVisit(document, currentUser.userId, entityManager);

    return this.toSummary(document);
  }

  async listChildrenForUser(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentTreeChild[]> {
    const document = await this.findDocumentOrThrow(documentId);

    await this.resolveWorkspaceForUser(document.workspace.id, currentUser);

    const entityManager = this.entityManager.fork();
    const children = await entityManager.find(DocumentEntity, {
      workspace: document.workspace.id,
      parentDocument: document.id,
      archivedAt: null,
    }, {
      populate: ['teamspace', 'parentDocument'],
      orderBy: {
        sortKey: 'asc',
        createdAt: 'asc',
      },
    });

    const hasChildrenByDocumentId = new Map<string, boolean>(
      await Promise.all(children.map(async (child) => {
        const count = await entityManager.count(DocumentEntity, {
          workspace: document.workspace.id,
          parentDocument: child.id,
          archivedAt: null,
        });

        return [child.id, count > 0] as const;
      })),
    );

    return children.map((child) => ({
      id: child.id,
      publicId: child.publicId,
      title: child.title,
      teamspaceId: child.teamspace?.id,
      parentDocumentId: child.parentDocument?.id,
      sortKey: child.sortKey,
      hasChildren: hasChildrenByDocumentId.get(child.id) ?? false,
      hasContent: this.hasMeaningfulContent(child.contentJson),
    }));
  }

  async createForUser(
    currentUser: AuthenticatedUser,
    input: CreateDocumentInput,
  ): Promise<DocumentSummary> {
    const workspace = await this.resolveWorkspaceForUser(input.workspaceId, currentUser);
    const entityManager = this.entityManager.fork();
    const user = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });

    const parentDocument = input.parentDocumentId
      ? await this.findDocumentOrThrow(input.parentDocumentId, entityManager)
      : undefined;

    const teamspace = await this.resolveTeamspaceForCreate(
      workspace.id,
      input.teamspaceId,
      parentDocument?.teamspace?.id,
      entityManager,
    );

    if (parentDocument && parentDocument.workspace.id !== workspace.id) {
      throw new BadRequestException('Parent document does not belong to the selected workspace.');
    }

    const document = entityManager.create(DocumentEntity, {
      workspace: workspace.id,
      teamspace: teamspace?.id,
      parentDocument: parentDocument?.id,
      title: this.normalizeTitle(input.title),
      contentFormat: input.contentFormat ?? DEFAULT_CONTENT_FORMAT,
      contentJson: this.normalizeContent(input.content),
      searchText: extractDocumentSearchText(this.normalizeContent(input.content)),
      sortKey: await this.resolveSortKeyForCreate(
        workspace.id,
        parentDocument?.id,
        teamspace?.id,
        entityManager,
      ),
      createdBy: user,
      updatedBy: user,
    });

    await entityManager.persistAndFlush(document);
    await this.syncSubdocReferencesForDoc(document, entityManager);

    await this.auditService.record({
      action: 'document.created',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
        teamspaceId: teamspace?.id,
        parentDocumentId: parentDocument?.id,
      },
    });

    return this.toSummary(document);
  }

  async duplicateForUser(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const entityManager = this.entityManager.fork();
    const sourceDocument = await this.findDocumentOrThrow(documentId, entityManager);
    const workspace = await this.resolveWorkspaceForUser(sourceDocument.workspace.id, currentUser);
    assertWorkspaceEditor(workspace.currentUserRole);

    if (sourceDocument.archivedAt) {
      throw new BadRequestException('Archived document cannot be duplicated.');
    }

    const {
      duplicatedRootDocument,
      duplicatedDocuments,
      originalDocumentByDuplicateId,
    } = await this.entityManager.transactional(async (transactionalEntityManager) => {
      const actor = await transactionalEntityManager.findOneOrFail(CurrentUserEntity, {
        id: currentUser.userId,
      });
      const sourceSubtree = await this.findActiveSubtreeDocuments(
        sourceDocument.id,
        sourceDocument.workspace.id,
        transactionalEntityManager,
      );
      const sourceRootDocument = sourceSubtree[0]!;
      const duplicatedDocumentByOriginalId = new Map<string, DocumentEntity>();
      const duplicatedDocumentEntities: DocumentEntity[] = [];

      for (const originalDocument of sourceSubtree) {
        const duplicatedParentDocument = originalDocument.id === sourceDocument.id
          ? sourceRootDocument.parentDocument
          : duplicatedDocumentByOriginalId.get(originalDocument.parentDocument?.id ?? '');

        const duplicatedDocument = transactionalEntityManager.create(DocumentEntity, {
          workspace: originalDocument.workspace,
          teamspace: originalDocument.teamspace,
          parentDocument: duplicatedParentDocument,
          title: this.buildDuplicateTitle(originalDocument.title),
          contentFormat: originalDocument.contentFormat,
          contentJson: originalDocument.contentJson,
          searchText: originalDocument.searchText,
          sortKey: originalDocument.id === sourceDocument.id
            ? await this.resolveSortKeyForCreate(
              sourceRootDocument.workspace.id,
              sourceRootDocument.parentDocument?.id,
              sourceRootDocument.teamspace?.id,
              transactionalEntityManager,
            )
            : originalDocument.sortKey,
          createdBy: actor,
          updatedBy: actor,
        });

        duplicatedDocumentByOriginalId.set(originalDocument.id, duplicatedDocument);
        duplicatedDocumentEntities.push(duplicatedDocument);
      }

      for (const originalDocument of sourceSubtree) {
        const duplicatedDocument = duplicatedDocumentByOriginalId.get(originalDocument.id)!;
        duplicatedDocument.contentJson = this.replaceSubdocReferencesInContent(
          originalDocument.contentJson,
          duplicatedDocumentByOriginalId,
        );
        duplicatedDocument.contentJson = this.appendMissingChildSubdocBlocks(
          duplicatedDocument.contentJson,
          duplicatedDocument,
          duplicatedDocumentEntities,
        );
        duplicatedDocument.searchText = extractDocumentSearchText(duplicatedDocument.contentJson);
        duplicatedDocument.updatedBy = actor;
      }

      await transactionalEntityManager.persistAndFlush(duplicatedDocumentEntities);

      for (const duplicatedDocument of duplicatedDocumentEntities) {
        await this.syncSubdocReferencesForDoc(duplicatedDocument, transactionalEntityManager);
      }

      await transactionalEntityManager.flush();

      return {
        duplicatedRootDocument: duplicatedDocumentByOriginalId.get(sourceDocument.id)!,
        duplicatedDocuments: duplicatedDocumentEntities,
        originalDocumentByDuplicateId: new Map(
          sourceSubtree.map((originalDocument) => [
            duplicatedDocumentByOriginalId.get(originalDocument.id)!.id,
            originalDocument,
          ]),
        ),
      };
    });

    await Promise.all(duplicatedDocuments.map((duplicatedDocument) =>
      this.auditService.record({
        action: 'document.created',
        resourceType: 'document',
        resourceId: duplicatedDocument.id,
        metadata: {
          workspaceId: duplicatedDocument.workspace.id,
          teamspaceId: duplicatedDocument.teamspace?.id,
          parentDocumentId: duplicatedDocument.parentDocument?.id,
          duplicatedFromDocumentId: originalDocumentByDuplicateId.get(duplicatedDocument.id)?.id,
        },
      }),
    ));

    return this.toSummary(duplicatedRootDocument);
  }

  async updateForUser(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: UpdateDocumentInput,
  ): Promise<DocumentSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    const workspace = await this.resolveWorkspaceForUser(document.workspace.id, currentUser);
    assertWorkspaceEditor(workspace.currentUserRole);

    try {
      await entityManager.lock(document, LockMode.OPTIMISTIC, input.version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new ConflictException('Document version conflict.');
      }

      throw error;
    }

    if (input.title !== undefined) {
      document.title = this.normalizeTitle(input.title);
    }

    if (input.contentFormat !== undefined) {
      document.contentFormat = input.contentFormat;
    }

    if (input.content !== undefined) {
      document.contentJson = this.normalizeContent(input.content);
      document.searchText = extractDocumentSearchText(document.contentJson);
    }

    document.updatedBy = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });

    if (input.content !== undefined) {
      await this.syncSubdocReferencesForDoc(document, entityManager);
    }

    if (input.title !== undefined) {
      await this.syncReferencedSubdocTitles(document, entityManager);
    }

    await entityManager.persistAndFlush(document);

    await this.auditService.record({
      action: 'document.updated',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
      },
    });

    return this.toSummary(document);
  }

  async archiveForUser(
    documentId: string,
    version: number,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    const workspace = await this.resolveWorkspaceForUser(document.workspace.id, currentUser);
    assertWorkspaceEditor(workspace.currentUserRole);

    try {
      await entityManager.lock(document, LockMode.OPTIMISTIC, version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new ConflictException('Document version conflict.');
      }

      throw error;
    }

    const descendants = await this.findDescendants(document.id, document.workspace.id, entityManager);
    const archivedAt = new Date();
    const actor = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });

    for (const item of [document, ...descendants]) {
      item.archivedAt = archivedAt;
      item.updatedBy = actor;
    }

    await entityManager.persist([document, ...descendants]).flush();

    await this.auditService.record({
      action: 'document.archived',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
      },
    });

    return this.toSummary(document);
  }

  async restoreForUser(
    documentId: string,
    version: number,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    const workspace = await this.resolveWorkspaceForUser(document.workspace.id, currentUser);
    assertWorkspaceEditor(workspace.currentUserRole);

    try {
      await entityManager.lock(document, LockMode.OPTIMISTIC, version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new ConflictException('Document version conflict.');
      }

      throw error;
    }

    const descendants = await this.findDescendants(document.id, document.workspace.id, entityManager);
    const actor = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });

    for (const item of [document, ...descendants]) {
      item.archivedAt = undefined;
      item.updatedBy = actor;
    }

    await entityManager.persist([document, ...descendants]).flush();

    await this.auditService.record({
      action: 'document.restored',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
      },
    });

    return this.toSummary(document);
  }

  async moveForUser(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: MoveDocumentInput,
  ): Promise<DocumentSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    const workspace = await this.resolveWorkspaceForUser(document.workspace.id, currentUser);
    assertWorkspaceEditor(workspace.currentUserRole);

    try {
      await entityManager.lock(document, LockMode.OPTIMISTIC, input.version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new ConflictException('Document version conflict.');
      }

      throw error;
    }

    const nextParent = input.parentDocumentId
      ? await this.findDocumentOrThrow(input.parentDocumentId, entityManager)
      : undefined;

    if (nextParent && nextParent.workspace.id !== workspace.id) {
      throw new BadRequestException('Parent document does not belong to this workspace.');
    }

    if (nextParent && await this.isDescendantOf(nextParent.id, document.id, document.workspace.id, entityManager)) {
      throw new BadRequestException('Document cannot be moved into one of its descendants.');
    }

    const nextTeamspace = await this.resolveTeamspaceForCreate(
      workspace.id,
      input.teamspaceId === undefined ? document.teamspace?.id : input.teamspaceId ?? undefined,
      nextParent?.teamspace?.id,
      entityManager,
    );

    document.parentDocument = nextParent;
    document.teamspace = nextTeamspace;
    document.sortKey = await this.resolveSortKeyForMove(
      document.id,
      workspace.id,
      nextParent?.id,
      nextTeamspace?.id,
      input.index,
      entityManager,
    );
    document.updatedBy = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });

    await entityManager.persist(document).flush();

    await this.auditService.record({
      action: 'document.moved',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
        parentDocumentId: nextParent?.id,
        teamspaceId: nextTeamspace?.id,
      },
    });

    return this.toSummary(document);
  }

  private async resolveTeamspaceForCreate(
    workspaceId: string,
    requestedTeamspaceId: string | undefined,
    inheritedTeamspaceId: string | undefined,
    entityManager: EntityManager,
  ): Promise<TeamspaceEntity | undefined> {
    const teamspaceId = inheritedTeamspaceId ?? requestedTeamspaceId;

    if (!teamspaceId) {
      return undefined;
    }

    const teamspace = await entityManager.findOne(TeamspaceEntity, {
      id: teamspaceId,
      workspace: workspaceId,
    });

    if (!teamspace) {
      throw new NotFoundException(`Teamspace ${teamspaceId} was not found.`);
    }

    return teamspace;
  }

  private async resolveSortKeyForCreate(
    workspaceId: string,
    parentDocumentId: string | undefined,
    teamspaceId: string | undefined,
    entityManager: EntityManager,
  ): Promise<number> {
    const firstSibling = await entityManager.findOne(DocumentEntity, {
      workspace: workspaceId,
      parentDocument: parentDocumentId ?? null,
      teamspace: teamspaceId ?? null,
      archivedAt: null,
    }, {
      orderBy: {
        sortKey: 'asc',
        createdAt: 'asc',
      },
    });

    return (firstSibling?.sortKey ?? SORT_STEP) - SORT_STEP;
  }

  private async resolveSortKeyForMove(
    documentId: string,
    workspaceId: string,
    parentDocumentId: string | undefined,
    teamspaceId: string | undefined,
    index: number | undefined,
    entityManager: EntityManager,
  ): Promise<number> {
    const siblings = await entityManager.find(DocumentEntity, {
      workspace: workspaceId,
      parentDocument: parentDocumentId ?? null,
      teamspace: teamspaceId ?? null,
      id: { $ne: documentId },
    }, {
      orderBy: {
        sortKey: 'asc',
        createdAt: 'asc',
      },
    });

    if (index === undefined || index >= siblings.length) {
      const lastSortKey = siblings[siblings.length - 1]?.sortKey ?? -SORT_STEP;
      return lastSortKey + SORT_STEP;
    }

    if (index <= 0) {
      return (siblings[0]?.sortKey ?? SORT_STEP) - SORT_STEP;
    }

    const previous = siblings[index - 1];
    const next = siblings[index];

    if (next.sortKey - previous.sortKey > 1) {
      return previous.sortKey + Math.floor((next.sortKey - previous.sortKey) / 2);
    }

    siblings.splice(index, 0, { ...next, sortKey: next.sortKey } as DocumentEntity);
    siblings.forEach((sibling, siblingIndex) => {
      sibling.sortKey = siblingIndex * SORT_STEP;
    });
    await entityManager.persistAndFlush(siblings);

    return siblings[index].sortKey;
  }

  private async findDocumentOrThrow(
    documentIdentifier: string,
    entityManager = this.entityManager.fork(),
  ): Promise<DocumentEntity> {
    const document = await entityManager.findOne(DocumentEntity, {
      $or: [
        { id: documentIdentifier },
        { publicId: documentIdentifier },
      ],
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'updatedBy'],
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentIdentifier} was not found.`);
    }

    return document;
  }

  private async findDescendants(
    documentId: string,
    workspaceId: string,
    entityManager: EntityManager,
  ): Promise<DocumentEntity[]> {
    const descendants: DocumentEntity[] = [];
    let parentDocumentIds = [documentId];

    while (parentDocumentIds.length > 0) {
      const children = await entityManager.find(DocumentEntity, {
        workspace: workspaceId,
        parentDocument: { $in: parentDocumentIds },
      }, {
        populate: ['parentDocument', 'workspace', 'teamspace', 'createdBy', 'updatedBy'],
        orderBy: {
          sortKey: 'asc',
          createdAt: 'asc',
        },
      });

      if (children.length === 0) {
        break;
      }

      descendants.push(...children);
      parentDocumentIds = children.map((document) => document.id);
    }

    return descendants;
  }

  private async findActiveSubtreeDocuments(
    documentId: string,
    workspaceId: string,
    entityManager: EntityManager,
  ): Promise<DocumentEntity[]> {
    const rootDocument = await entityManager.findOne(DocumentEntity, {
      id: documentId,
      workspace: workspaceId,
      archivedAt: null,
    }, {
      populate: ['parentDocument', 'workspace', 'teamspace', 'createdBy', 'updatedBy'],
    });

    if (!rootDocument) {
      throw new NotFoundException(`Document ${documentId} was not found.`);
    }

    const subtree = [rootDocument];
    let parentDocumentIds = [rootDocument.id];

    while (parentDocumentIds.length > 0) {
      const children = await entityManager.find(DocumentEntity, {
        workspace: workspaceId,
        archivedAt: null,
        parentDocument: { $in: parentDocumentIds },
      }, {
        populate: ['parentDocument', 'workspace', 'teamspace', 'createdBy', 'updatedBy'],
        orderBy: {
          sortKey: 'asc',
          createdAt: 'asc',
        },
      });

      if (children.length === 0) {
        break;
      }

      subtree.push(...children);
      parentDocumentIds = children.map((document) => document.id);
    }

    return subtree;
  }

  private async isDescendantOf(
    candidateDocumentId: string,
    ancestorDocumentId: string,
    workspaceId: string,
    entityManager: EntityManager,
  ): Promise<boolean> {
    const descendants = await this.findDescendants(ancestorDocumentId, workspaceId, entityManager);

    return descendants.some((document) => document.id === candidateDocumentId);
  }

  private async listDocumentNavigationPage(
    workspaceId: string,
    entityManager: EntityManager,
    input: {
      teamspaceId?: string | null;
      parentDocumentId?: string | null;
      limit: number;
      cursor?: string;
      query?: string;
    },
  ): Promise<DocumentNavigationPage> {
    const normalizedQuery = input.query?.trim();
    const where: FilterQuery<DocumentEntity> = {
      workspace: workspaceId,
      teamspace: input.teamspaceId ?? null,
      parentDocument: input.parentDocumentId ?? null,
      archivedAt: null,
      ...(normalizedQuery
        ? {
          title: {
            $ilike: `%${normalizedQuery}%`,
          },
        }
        : {}),
    };
    const documents = await entityManager.find(DocumentEntity, where, {
      populate: ['teamspace', 'parentDocument'],
      orderBy: {
        sortKey: 'asc',
        id: 'asc',
      },
    });
    const cursor = input.cursor
      ? this.decodeDocumentListCursor(input.cursor)
      : undefined;
    const visibleDocuments = cursor
      ? documents.filter((document) =>
        document.sortKey > cursor.sortKey
          || (document.sortKey === cursor.sortKey && document.id > cursor.id))
      : documents;
    const pagedDocuments = visibleDocuments.slice(0, input.limit + 1);
    const hasMore = pagedDocuments.length > input.limit;
    const items = pagedDocuments.slice(0, input.limit);

    return {
      items: await this.toDocumentNavigationNodes(items, workspaceId, entityManager),
      nextCursor: hasMore ? this.encodeDocumentListCursor(items[items.length - 1]!) : undefined,
    };
  }

  private async toDocumentNavigationNodes(
    documents: DocumentEntity[],
    workspaceId: string,
    entityManager: EntityManager,
  ): Promise<DocumentNavigationNode[]> {
    const hasChildrenByDocumentId = new Map<string, boolean>(
      await Promise.all(documents.map(async (document) => {
        const childCount = await entityManager.count(DocumentEntity, {
          workspace: workspaceId,
          parentDocument: document.id,
          archivedAt: null,
        });

        return [document.id, childCount > 0] as const;
      })),
    );

    return documents.map((document) => ({
      id: document.id,
      publicId: document.publicId,
      title: document.title,
      teamspaceId: document.teamspace?.id,
      parentDocumentId: document.parentDocument?.id,
      sortKey: document.sortKey,
      hasChildren: hasChildrenByDocumentId.get(document.id) ?? false,
      hasContent: this.hasMeaningfulContent(document.contentJson),
    }));
  }

  private encodeDocumentListCursor(document: Pick<DocumentEntity, 'id' | 'sortKey'>): string {
    return Buffer.from(JSON.stringify({
      id: document.id,
      sortKey: document.sortKey,
    })).toString('base64url');
  }

  private decodeDocumentListCursor(cursor: string): { id: string; sortKey: number } {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        id?: unknown;
        sortKey?: unknown;
      };

      if (typeof parsed.id !== 'string' || typeof parsed.sortKey !== 'number') {
        throw new Error('Invalid cursor');
      }

      return {
        id: parsed.id,
        sortKey: parsed.sortKey,
      };
    }
    catch {
      throw new BadRequestException('Invalid document cursor.');
    }
  }

  private toSummary(document: DocumentEntity): DocumentSummary {
    return {
      id: document.id,
      publicId: document.publicId,
      version: document.version,
      workspaceId: document.workspace.id,
      teamspaceId: document.teamspace?.id,
      parentDocumentId: document.parentDocument?.id,
      title: document.title,
      contentFormat: document.contentFormat as 'blocknote_v1',
      content: document.contentJson,
      sortKey: document.sortKey,
      archivedAt: document.archivedAt,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private normalizeTitle(value?: string): string {
    const normalized = value?.trim();

    return normalized && normalized.length > 0 ? normalized : DEFAULT_DOCUMENT_TITLE;
  }

  private normalizeContent(value?: unknown[]): unknown[] {
    if (!value || value.length === 0) {
      return DEFAULT_DOCUMENT_CONTENT;
    }

    return value;
  }

  private async syncSubdocReferencesForDoc(
    document: DocumentEntity,
    entityManager: EntityManager,
  ): Promise<void> {
    const nextTargetDocumentIds = this.extractSubdocTargetDocumentIds(document.contentJson);
    const existingReferences = await entityManager.find(DocumentSubdocReferenceEntity, {
      sourceDocument: document.id,
    }, {
      populate: ['workspace', 'sourceDocument', 'targetDocument'],
    });
    const existingTargetDocumentIds = new Set(
      existingReferences.map((reference) => reference.targetDocument.id),
    );

    for (const reference of existingReferences) {
      if (nextTargetDocumentIds.has(reference.targetDocument.id)) {
        continue;
      }

      entityManager.remove(reference);
    }

    const newReferences: DocumentSubdocReferenceEntity[] = [];

    for (const targetDocumentId of nextTargetDocumentIds) {
      if (existingTargetDocumentIds.has(targetDocumentId)) {
        continue;
      }

      newReferences.push(entityManager.create(DocumentSubdocReferenceEntity, {
        workspace: document.workspace.id,
        sourceDocument: document.id,
        targetDocument: targetDocumentId,
      }));
    }

    if (newReferences.length > 0) {
      entityManager.persist(newReferences);
    }
  }

  private async syncReferencedSubdocTitles(
    document: DocumentEntity,
    entityManager: EntityManager,
  ): Promise<void> {
    const references = await entityManager.find(DocumentSubdocReferenceEntity, {
      targetDocument: document.id,
    }, {
      populate: ['sourceDocument', 'sourceDocument.workspace', 'sourceDocument.teamspace', 'sourceDocument.parentDocument', 'sourceDocument.createdBy', 'sourceDocument.updatedBy'],
    });

    if (references.length === 0) {
      const referencingDocuments = await entityManager.find(DocumentEntity, {
        workspace: document.workspace.id,
        archivedAt: null,
        id: { $ne: document.id },
      }, {
        populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'updatedBy'],
      });

      for (const sourceDocument of referencingDocuments) {
        const { changed, content } = this.replaceSubdocTitleInContent(
          sourceDocument.contentJson,
          document.id,
          document.title,
        );

        if (!changed) {
          continue;
        }

        sourceDocument.contentJson = content;
        sourceDocument.searchText = extractDocumentSearchText(content);
        sourceDocument.updatedBy = document.updatedBy;
        await this.syncSubdocReferencesForDoc(sourceDocument, entityManager);
      }

      return;
    }

    for (const reference of references) {
      const sourceDocument = reference.sourceDocument;
      const { changed, content } = this.replaceSubdocTitleInContent(
        sourceDocument.contentJson,
        document.id,
        document.title,
      );

      if (!changed) {
        continue;
      }

      sourceDocument.contentJson = content;
      sourceDocument.searchText = extractDocumentSearchText(content);
      sourceDocument.updatedBy = document.updatedBy;
    }
  }

  private extractSubdocTargetDocumentIds(content: unknown[]): Set<string> {
    const targetDocumentIds = new Set<string>();

    const visitBlock = (value: unknown): void => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return;
      }

      const block = value as {
        type?: unknown;
        props?: unknown;
        children?: unknown;
      };

      if (
        block.type === SUBDOC_BLOCK_TYPE
        && block.props
        && typeof block.props === 'object'
        && !Array.isArray(block.props)
      ) {
        const documentId = (block.props as { documentId?: unknown }).documentId;

        if (typeof documentId === 'string' && documentId.length > 0) {
          targetDocumentIds.add(documentId);
        }
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        block.children.forEach(visitBlock);
      }
    };

    content.forEach(visitBlock);

    return targetDocumentIds;
  }

  private replaceSubdocTitleInContent(
    content: unknown[],
    documentId: string,
    title: string,
  ): { changed: boolean; content: unknown[] } {
    let changed = false;

    const replaceInBlock = (value: unknown): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
      }

      const block = value as {
        type?: unknown;
        props?: unknown;
        content?: unknown;
        children?: unknown;
      };

      let nextBlock = block;

      if (
        block.type === SUBDOC_BLOCK_TYPE
        && block.props
        && typeof block.props === 'object'
        && !Array.isArray(block.props)
        && (block.props as { documentId?: unknown }).documentId === documentId
        && (block.props as { title?: unknown }).title !== title
      ) {
        changed = true;
        nextBlock = {
          ...block,
          props: {
            ...(block.props as Record<string, unknown>),
            title,
          },
        };
      }

      if (Array.isArray(nextBlock.children) && nextBlock.children.length > 0) {
        const nextChildren = nextBlock.children.map(replaceInBlock);

        if (nextChildren.some((child, index) => child !== nextBlock.children?.[index])) {
          nextBlock = {
            ...nextBlock,
            children: nextChildren,
          };
        }
      }

      return nextBlock;
    };

    const nextContent = content.map(replaceInBlock);

    return {
      changed,
      content: changed ? nextContent : content,
    };
  }

  private replaceSubdocReferencesInContent(
    content: unknown[],
    duplicatedDocumentByOriginalId: Map<string, DocumentEntity>,
  ): unknown[] {
    let changed = false;

    const replaceInBlock = (value: unknown): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
      }

      const block = value as {
        type?: unknown;
        props?: unknown;
        children?: unknown;
      };

      let nextBlock = block;

      if (
        block.type === SUBDOC_BLOCK_TYPE
        && block.props
        && typeof block.props === 'object'
        && !Array.isArray(block.props)
      ) {
        const props = block.props as {
          documentId?: unknown;
          publicId?: unknown;
          title?: unknown;
        };
        const duplicatedDocument = typeof props.documentId === 'string'
          ? duplicatedDocumentByOriginalId.get(props.documentId)
          : undefined;

        if (duplicatedDocument) {
          changed = true;
          nextBlock = {
            ...block,
            props: {
              ...props,
              documentId: duplicatedDocument.id,
              publicId: duplicatedDocument.publicId,
              title: duplicatedDocument.title,
            },
          };
        }
      }

      if (Array.isArray(nextBlock.children) && nextBlock.children.length > 0) {
        const nextChildren = nextBlock.children.map(replaceInBlock);

        if (nextChildren.some((child, index) => child !== nextBlock.children?.[index])) {
          nextBlock = {
            ...nextBlock,
            children: nextChildren,
          };
        }
      }

      return nextBlock;
    };

    const nextContent = content.map(replaceInBlock);

    return changed ? nextContent : content;
  }

  private buildDuplicateTitle(title: string): string {
    const match = title.match(/^(.*) \((\d+)\)$/);

    if (!match) {
      return `${title} (1)`;
    }

    return `${match[1]} (${Number(match[2]) + 1})`;
  }

  private appendMissingChildSubdocBlocks(
    content: unknown[],
    parentDocument: DocumentEntity,
    duplicatedDocuments: DocumentEntity[],
  ): unknown[] {
    const referencedDocumentIds = this.extractSubdocTargetDocumentIds(content);
    const directChildren = duplicatedDocuments.filter((document) => document.parentDocument?.id === parentDocument.id);
    const missingChildren = directChildren.filter((child) => !referencedDocumentIds.has(child.id));

    if (missingChildren.length === 0) {
      return content;
    }

    const newBlocks = missingChildren.map((child) => ({
      id: randomUUID(),
      type: SUBDOC_BLOCK_TYPE,
      props: {
        documentId: child.id,
        publicId: child.publicId,
        workspaceId: child.workspace.id,
        title: child.title,
      },
      children: [],
    }));

    return [...content, ...newBlocks];
  }

  private hasMeaningfulContent(content: unknown[]): boolean {
    if (!Array.isArray(content) || content.length === 0) {
      return false;
    }

    if (content.length > 1) {
      return true;
    }

    const [firstBlock] = content;

    if (!firstBlock || typeof firstBlock !== 'object' || Array.isArray(firstBlock)) {
      return true;
    }

    const block = firstBlock as {
      type?: unknown;
      content?: unknown;
      children?: unknown;
      props?: unknown;
    };

    if (block.type !== 'paragraph') {
      return true;
    }

    if (Array.isArray(block.content) && block.content.length > 0) {
      return true;
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      return true;
    }

    if (
      block.props
      && typeof block.props === 'object'
      && !Array.isArray(block.props)
      && Object.values(block.props).some((value) => value !== undefined && value !== null && value !== '')
    ) {
      return true;
    }

    return false;
  }

  private async recordVisit(
    document: DocumentEntity,
    userId: string,
    entityManager: EntityManager,
  ): Promise<void> {
    const [user, existingVisit] = await Promise.all([
      entityManager.findOneOrFail(CurrentUserEntity, { id: userId }),
      entityManager.findOne(DocumentVisitEntity, {
        user: userId,
        document: document.id,
      }),
    ]);

    const visit = existingVisit ?? entityManager.create(DocumentVisitEntity, {
      workspace: document.workspace,
      document,
      user,
      lastVisitedAt: new Date(),
    });

    visit.workspace = document.workspace;
    visit.document = document;
    visit.user = user;
    visit.lastVisitedAt = new Date();

    await entityManager.persist(visit).flush();
  }

  private async resolveWorkspaceForUser(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ) {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
    const workspace = workspaces.find((item) =>
      item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
    );

    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceIdentifier} was not found.`);
    }

    return workspace;
  }
}
