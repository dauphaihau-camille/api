import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DocumentCollaborationGateway } from '../api/ws/document-collaboration.gateway';
import { DocumentTreeService } from '../app/services/document-tree.service';
import { DocumentAccessChangedEvent } from '../events/document-access-changed.event';

@Injectable()
export class NotifyCollaborationPermissionsChangedListener {
  private readonly logger = new Logger(
    NotifyCollaborationPermissionsChangedListener.name,
  );

  constructor(
    private readonly collaborationGateway: DocumentCollaborationGateway,
    private readonly documentTreeService: DocumentTreeService,
  ) {}

  @OnEvent('document.access.changed', { async: true, suppressErrors: true })
  async handle(event: DocumentAccessChangedEvent): Promise<void> {
    try {
      const descendants = await this.documentTreeService.findDescendants(
        event.documentId,
        event.workspaceId,
      );

      const affectedDocumentIds = [
        event.documentId,
        ...descendants.map((descendant) => descendant.id),
      ];
      
      for (const documentId of affectedDocumentIds) {
        this.collaborationGateway.notifyPermissionsChanged(documentId);
      }
    }
    catch (error) {
      this.logger.warn(
        `Collaboration permission notification failed, continuing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
