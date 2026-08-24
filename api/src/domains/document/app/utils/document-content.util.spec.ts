import { countContentBlocks } from './document-content.util';

describe('document content utilities', () => {
  describe('countContentBlocks', () => {
    it('counts top-level and nested blocks', () => {
      expect(countContentBlocks([
        { type: 'heading' },
        { type: 'paragraph' },
        {
          type: 'toggle',
          children: [
            { type: 'paragraph' },
            { type: 'checkListItem' },
          ],
        },
      ])).toBe(5);
    });

    it('returns zero for non-array content', () => {
      expect(countContentBlocks(null)).toBe(0);
      expect(countContentBlocks({ type: 'paragraph' })).toBe(0);
    });
  });
});
