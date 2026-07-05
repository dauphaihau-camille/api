type ContentBlock = {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: unknown;
};

export function collectReferencedSubdocIds(content: unknown[]): string[] {
  const documentIds = new Set<string>();

  function visitNode(node: unknown) {
    if (!node || typeof node !== 'object') {
      return;
    }

    const block = node as ContentBlock;

    if (
      block.type === 'subpage'
      && block.props
      && typeof block.props.documentId === 'string'
      && block.props.documentId.length > 0
    ) {
      documentIds.add(block.props.documentId);
    }

    if (Array.isArray(block.content)) {
      block.content.forEach(visitNode);
    }

    if (Array.isArray(block.children)) {
      block.children.forEach(visitNode);
    }
  }

  content.forEach(visitNode);

  return [...documentIds];
}

export function withPublishedSubdocTargets(
  content: unknown[],
  publishedSubdocIdByDocumentId: Map<string, string>,
): unknown[] {
  function mapNode(node: unknown): unknown {
    if (!node || typeof node !== 'object') {
      return node;
    }

    const block = node as ContentBlock;
    let nextNode = node as Record<string, unknown>;

    if (
      block.type === 'subpage'
      && block.props
      && typeof block.props.documentId === 'string'
      && block.props.documentId.length > 0
    ) {
      const publishedDocumentId = publishedSubdocIdByDocumentId.get(block.props.documentId);
      const nextProps = {
        ...block.props,
        publishedDocumentId: publishedDocumentId ?? '',
      };
      nextNode = {
        ...nextNode,
        props: nextProps,
      };
    }

    if (Array.isArray(block.content)) {
      nextNode = {
        ...nextNode,
        content: block.content.map(mapNode),
      };
    }

    if (Array.isArray(block.children)) {
      nextNode = {
        ...nextNode,
        children: block.children.map(mapNode),
      };
    }

    return nextNode;
  }

  return content.map(mapNode);
}
