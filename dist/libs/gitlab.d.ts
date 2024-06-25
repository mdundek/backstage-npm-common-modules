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
    /**
     * getSubgroupIdByName
     * @param search
     * @param personalAccessToken
     * @returns
     */
    getSubgroupIdByName: (search: string, personalAccessToken: string) => Promise<string>;
    /**
     * createGitlabRepoCiVar
     * @param projectId
     * @param personalAccessToken
     * @param varKey
     * @param varValue
     * @param masked
     */
    createGitlabRepoCiVar: (projectId: string, personalAccessToken: string, varKey: string, varValue: string, masked: boolean) => Promise<void>;
    /**
     * createGitlabRepo
     * @param options
     * @param personalAccessToken
     * @returns
     */
    createGitlabRepo: (options: CreateRepoOptions, personalAccessToken: string) => Promise<any>;
};
export interface CreateRepoOptions {
    name: string;
    namespaceId?: string;
    description?: string;
    visibility: string;
}
//# sourceMappingURL=gitlab.d.ts.map