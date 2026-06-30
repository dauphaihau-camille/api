import { type FilterQuery, LockMode, OptimisticLockError } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
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
import {
  DEFAULT_CONTENT_FORMAT,
  DEFAULT_DOCUMENT_CONTENT,
  DEFAULT_DOCUMENT_TITLE,
  SORT_STEP,
} from './document-defaults';
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
    const document = await this.findDocumentOrThrow(documentId);

    await this.resolveWorkspaceForUser(document.workspace.id, currentUser);

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
      title: child.title,
      teamspaceId: child.teamspace?.id,
      parentDocumentId: child.parentDocument?.id,
      sortKey: child.sortKey,
      hasChildren: hasChildrenByDocumentId.get(child.id) ?? false,
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

    const firstSibling = await entityManager.findOne(DocumentEntity, {
      workspace: workspace.id,
      parentDocument: parentDocument?.id ?? null,
      teamspace: teamspace?.id ?? null,
      archivedAt: null,
    }, {
      orderBy: {
        sortKey: 'asc',
        createdAt: 'asc',
      },
    });

    const document = entityManager.create(DocumentEntity, {
      workspace: workspace.id,
      teamspace: teamspace?.id,
      parentDocument: parentDocument?.id,
      title: this.normalizeTitle(input.title),
      contentFormat: input.contentFormat ?? DEFAULT_CONTENT_FORMAT,
      contentJson: this.normalizeContent(input.content),
      sortKey: (firstSibling?.sortKey ?? SORT_STEP) - SORT_STEP,
      createdBy: user,
      updatedBy: user,
    });

    await entityManager.persistAndFlush(document);

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
    }

    document.updatedBy = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });

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

    await entityManager.persistAndFlush([document, ...descendants]);

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

    await entityManager.persistAndFlush([document, ...descendants]);

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

    await entityManager.persistAndFlush(document);

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
    documentId: string,
    entityManager = this.entityManager.fork(),
  ): Promise<DocumentEntity> {
    const document = await entityManager.findOne(DocumentEntity, { id: documentId }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'updatedBy'],
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} was not found.`);
    }

    return document;
  }

  private async findDescendants(
    documentId: string,
    workspaceId: string,
    entityManager: EntityManager,
  ): Promise<DocumentEntity[]> {
    const documents = await entityManager.find(DocumentEntity, {
      workspace: workspaceId,
    }, {
      populate: ['parentDocument', 'workspace', 'teamspace', 'createdBy', 'updatedBy'],
    });
    const descendants: DocumentEntity[] = [];
    const queue = [documentId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = documents.filter((document) => document.parentDocument?.id === currentId);

      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }

    return descendants;
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
      title: document.title,
      teamspaceId: document.teamspace?.id,
      parentDocumentId: document.parentDocument?.id,
      sortKey: document.sortKey,
      hasChildren: hasChildrenByDocumentId.get(document.id) ?? false,
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
