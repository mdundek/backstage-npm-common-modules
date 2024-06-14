export declare const backstageApi: {
    getEntitiesByRef: (refs: any, token: string) => Promise<any>;
    getEntityUid: (kind: string, namespace: string, name: string, token: string) => Promise<any>;
    findDependantComponents: (name: string, token: string) => Promise<any>;
    findSystemNeotekTypedComponents: (type: string, system: string, token: string) => Promise<any>;
    deleteByUid: (uid: string, token: string) => Promise<void>;
    addNewLocation: (catalogYamlPath: string, token: string) => Promise<void>;
    refreshLocations: (token: string) => Promise<void>;
};
//# sourceMappingURL=backstageApi.d.ts.map