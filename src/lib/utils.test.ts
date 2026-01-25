import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('utils.ts', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const condition = true;
      expect(cn('base', condition && 'active')).toBe('base active');
      expect(cn('base', condition && 'active', !condition && 'disabled')).toBe('base active');
    });

    it('should handle tailwind classes', () => {
      expect(cn('px-4 py-2', 'bg-blue-500')).toBe('px-4 py-2 bg-blue-500');
    });

    it('should handle tailwind conflict resolution', () => {
      expect(cn('p-4 p-2')).toBe('p-2');
      expect(cn('text-red text-blue-500')).toBe('text-blue-500');
    });

    it('should handle empty inputs', () => {
      expect(cn()).toBe('');
    });

    it('should handle mixed inputs', () => {
      expect(cn('foo', { bar: true, baz: false }, 'qux')).toBe('foo bar qux');
    });
  });
});
