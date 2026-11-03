import { describe, it, expect } from 'vitest';
import pkg from '../package.json';

describe('Project Scaffold', () => {
  it('defines RenArt package identity', () => {
    expect(pkg.name).toBe('renart');
    expect(pkg.description).toContain('RenArt');
    expect(pkg.description).toContain('vulcap');
  });

  it('defines required dependencies and scripts', () => {
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts).toHaveProperty('build');
    expect(pkg.scripts).toHaveProperty('test');
    expect(pkg.dependencies).toHaveProperty('konva');
    expect(pkg.dependencies).toHaveProperty('react-konva');
    expect(pkg.dependencies).toHaveProperty('jspdf');
    expect(pkg.dependencies).toHaveProperty('lucide-react');
  });
});
