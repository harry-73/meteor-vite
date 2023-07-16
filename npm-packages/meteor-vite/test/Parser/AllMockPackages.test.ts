import Path from 'path';
import { describe, expect, it, test } from 'vitest';
import MeteorPackage from '../../src/meteor/package/components/MeteorPackage';
import { parseMeteorPackage } from '../../src/meteor/package/parser/Parser';
import { AllMockPackages } from '../__mocks';

describe('Validate known exports for mock packages', () => {
    
    describe.each(AllMockPackages)(`meteor/$packageName`, async (mockPackage) => {
        const { result: parsedPackage } = await parseMeteorPackage({
            filePath: mockPackage.filePath,
            fileContent: mockPackage.fileContent,
        });
        
        
        describe('Parsed Metadata', () => {
            it('has the package name', () => {
                expect(parsedPackage.name).toEqual(mockPackage.packageName)
            });
            
            it('has a packageId', () => {
                expect(parsedPackage.packageId).toEqual(mockPackage.packageId);
            })
            
            it('detected the correct main module path', () => {
                expect(parsedPackage.mainModulePath).toEqual(mockPackage.mainModulePath);
            });
            
            it('has the correct mainModule exports', () => {
                const meteorPackage = new MeteorPackage(parsedPackage, { timeSpent: 'none' });
                const parsedPath = Path.parse(mockPackage.mainModulePath);
                const fileName = parsedPath.base as keyof typeof mockPackage['modules'];
                const mockModuleExports = mockPackage.modules[fileName];
                const mainModuleExports = meteorPackage.modules[meteorPackage.mainModule?.modulePath as any];
                
                if (meteorPackage.mainModule) {
                    expect(mainModuleExports.length).toBeGreaterThan(0)
                }
                
                expect(mainModuleExports).toEqual(mockModuleExports);
            })
        })
        
        
        describe('Files', () => {
            const files = Object.entries(mockPackage.modules);
            describe.runIf(files.length).each(files)('%s', (filePath, mockExports) => {
                const parsedExports =  parsedPackage.modules[filePath];
                
                
                it('has an array of exports', () => {
                    expect(Object.keys(parsedPackage.modules)).toContain(filePath);
                    expect(parsedExports).toBeDefined();
                });
                
                
                describe('Named exports', () => {
                    const exports = mockExports?.filter(({ type }) => type === 'export');
                    
                    describe.runIf(exports?.length).each(exports)(`export const $name`, (mockExport) => {
                        it('exists in parser results', () => {
                            expect(parsedExports).toEqual(
                                expect.arrayContaining([mockExport])
                            )
                        })
                    })
                })
                
                describe('Re-exports', () => {
                    const exports = mockExports?.filter(({ type }) => type === 're-export').map((entry) => [
                        `export ${entry.name} ${entry.as ? `as ${entry.as} ` : ''}from '${entry.from}'`,
                        entry,
                    ]);
                    
                    describe.runIf(exports?.length).each(exports)(`%s`, (testName, mockExport) => {
                        it('exists in parser results', () => {
                            expect(parsedExports).toEqual(
                                expect.arrayContaining([mockExport]),
                            );
                        })
                    });
                });
            })
        })
    })
});