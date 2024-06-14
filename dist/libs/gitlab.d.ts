export declare const gitlab: {
    downloadFile: (repositoryId: string, filePath: string, branchOrTag: string, personalAccessToken: string) => Promise<any>;
    uploadTextFile: (repositoryId: string, filePath: string, branchOrTag: string, personalAccessToken: string, content: string) => Promise<any>;
    fetchFile: (repositoryId: string, filePath: string, branchOrTag: string, personalAccessToken: string) => Promise<any>;
    /**
     *
     * @param repositoryId
     * @param folderPath
     * @param branch
     * @param personalAccessToken
     * @returns
     */
    getFilesFromFolder: (repositoryId: string, folderPath: string, branch: string, personalAccessToken: string) => Promise<any>;
};
//# sourceMappingURL=gitlab.d.ts.map