import type { DocumentCollaborationGateway } from '../api/ws/document-collaboration.gateway';
import type { DocumentTreeService } from '../app/services/document-tree.service';
import { DocumentAccessChangedEvent } from '../events/document-access-changed.event';
import { NotifyCollaborationPermissionsChangedListener } from './notify-collaboration-permissions-changed.listener';

describe('NotifyCollaborationPermissionsChangedListener', () => {
  it('notifies the changed document and all descendants', async () => {
    const collaborationGateway = {
      notifyPermissionsChanged: jest.fn(),
    } as unknown as jest.Mocked<DocumentCollaborationGateway>;
    const documentTreeService = {
      findDescendants: jest.fn().mockResolvedValue([
        { id: 'child-document' },
        { id: 'grandchild-document' },
      ]),
    } as unknown as jest.Mocked<DocumentTreeService>;
    const listener = new NotifyCollaborationPermissionsChangedListener(
      collaborationGateway,
      documentTreeService,
    );

    await listener.handle(new DocumentAccessChangedEvent('parent-document', 'workspace-1'));

    expect(documentTreeService.findDescendants).toHaveBeenCalledWith(
      'parent-document',
      'workspace-1',
    );
    expect(collaborationGateway.notifyPermissionsChanged).toHaveBeenCalledTimes(3);
    expect(collaborationGateway.notifyPermissionsChanged).toHaveBeenNthCalledWith(
      1,
      'parent-document',
    );
    expect(collaborationGateway.notifyPermissionsChanged).toHaveBeenNthCalledWith(
      2,
      'child-document',
    );
    expect(collaborationGateway.notifyPermissionsChanged).toHaveBeenNthCalledWith(
      3,
      'grandchild-document',
    );
  });
});
