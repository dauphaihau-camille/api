import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { UserEntity } from '../../user/infra/persistence/entities/user.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { DocumentAccessGrantPermission } from '../domain/enums/document-access-grant-permission.enum';
import {
  DocumentInvitationRepository,
  type DocumentInvitationSummary,
} from '../app/ports/document-invitation.repository';
import { DocumentEntity } from './persistence/entities/document.entity';
import { DocumentInvitationEntity } from './persistence/entities/document-invitation.entity';

@Injectable()
export class MikroOrmDocumentInvitationRepository extends DocumentInvitationRepository {
  constructor(private readonly entityManager: EntityManager) {
    super();
  }

  async upsertInvitation(input: {
    workspaceId: string;
    documentId: string;
    email: string;
    permission: DocumentAccessGrantPermission;
    invitedByUserId: string;
  }): Promise<DocumentInvitationSummary> {
    const entityManager = this.entityManager.fork();
    const invitationRepository = entityManager.getRepository(DocumentInvitationEntity);
    const existingInvitation = await invitationRepository.findOne({
      document: input.documentId,
      email: input.email,
    });

    if (existingInvitation) {
      existingInvitation.permission = input.permission;
      existingInvitation.invitedBy = entityManager.getReference(UserEntity, input.invitedByUserId);
      existingInvitation.acceptedAt = undefined;
      existingInvitation.acceptedBy = undefined;
      existingInvitation.revokedAt = undefined;
      await entityManager.persist(existingInvitation).flush();
      await entityManager.populate(existingInvitation, ['document', 'workspace', 'invitedBy']);

      return this.toSummary(existingInvitation);
    }

    const invitation = invitationRepository.create({
      workspace: entityManager.getReference(WorkspaceEntity, input.workspaceId),
      document: entityManager.getReference(DocumentEntity, input.documentId),
      email: input.email,
      permission: input.permission,
      invitedBy: entityManager.getReference(UserEntity, input.invitedByUserId),
    });

    await entityManager.persist(invitation).flush();
    await entityManager.populate(invitation, ['document', 'workspace', 'invitedBy']);

    return this.toSummary(invitation);
  }

  async listActiveInvitations(documentId: string): Promise<DocumentInvitationSummary[]> {
    const invitations = await this.entityManager.fork().find(
      DocumentInvitationEntity,
      {
        document: documentId,
        acceptedAt: null,
        revokedAt: null,
      },
      {
        populate: ['document', 'workspace', 'invitedBy'],
        orderBy: { createdAt: 'asc', id: 'asc' },
      },
    );

    return invitations.map((invitation) => this.toSummary(invitation));
  }

  async listActiveInvitationsForEmail(email: string): Promise<DocumentInvitationSummary[]> {
    const invitations = await this.entityManager.fork().find(
      DocumentInvitationEntity,
      {
        email,
        acceptedAt: null,
        revokedAt: null,
      },
      {
        populate: ['document', 'workspace', 'invitedBy'],
        orderBy: { createdAt: 'asc', id: 'asc' },
      },
    );

    return invitations.map((invitation) => this.toSummary(invitation));
  }

  async markInvitationAccepted(input: {
    invitationId: string;
    userId: string;
  }): Promise<void> {
    const entityManager = this.entityManager.fork();

    const invitation = await entityManager.findOne(DocumentInvitationEntity, {
      id: input.invitationId,
      acceptedAt: null,
      revokedAt: null,
    });

    if (!invitation) {
      return;
    }

    invitation.acceptedBy = entityManager.getReference(UserEntity, input.userId);
    invitation.acceptedAt = new Date();
    await entityManager.persist(invitation).flush();
  }

  async updateInvitationPermission(input: {
    documentId: string;
    invitationId: string;
    permission: DocumentAccessGrantPermission;
  }): Promise<DocumentInvitationSummary | null> {
    const entityManager = this.entityManager.fork();
    const invitation = await entityManager.findOne(
      DocumentInvitationEntity,
      {
        id: input.invitationId,
        document: input.documentId,
        acceptedAt: null,
        revokedAt: null,
      },
      {
        populate: ['document', 'workspace', 'invitedBy'],
      },
    );

    if (!invitation) {
      return null;
    }

    invitation.permission = input.permission;
    await entityManager.persist(invitation).flush();

    return this.toSummary(invitation);
  }

  async revokeInvitation(input: {
    documentId: string;
    invitationId: string;
  }): Promise<DocumentInvitationSummary | null> {
    const entityManager = this.entityManager.fork();

    const invitation = await entityManager.findOne(
      DocumentInvitationEntity,
      {
        id: input.invitationId,
        document: input.documentId,
        acceptedAt: null,
        revokedAt: null,
      },
      {
        populate: ['document', 'workspace', 'invitedBy'],
      },
    );

    if (!invitation) {
      return null;
    }

    invitation.revokedAt = new Date();
    await entityManager.persist(invitation).flush();

    return this.toSummary(invitation);
  }

  private toSummary(invitation: DocumentInvitationEntity): DocumentInvitationSummary {
    return {
      id: invitation.id,
      documentId: invitation.document.id,
      workspaceId: invitation.workspace.id,
      email: invitation.email,
      permission: invitation.permission,
      invitedByUserId: invitation.invitedBy.id,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }
}
