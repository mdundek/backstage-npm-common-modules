export const gitlab = {
    // Fetch a text file from a GitLab repository
    downloadFile: async (
        repositoryId: string,
        filePath: string,
        branchOrTag: string,
        personalAccessToken: string
    ): Promise<any> => {
        const url = `https://gitlab.ea.com/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(branchOrTag)}`;
        const response = await fetch(url, {
            headers: {
                'PRIVATE-TOKEN': personalAccessToken
            }
        });
        if (!response.ok) {
            console.error(`Failed to fetch file from GitLab: ${url}`);
            throw new Error(`Failed to fetch file from GitLab: ${response.statusText}`);
        }
        return await response.text();
    },
    // Upload a text file to a GitLab repository
    uploadTextFile: async (
        repositoryId: string,
        filePath: string,
        branchOrTag: string,
        personalAccessToken: string,
        content: string,
    ): Promise<any> => {
        const url = `https://gitlab.ea.com/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/files/${encodeURIComponent(filePath)}`;

        // CHeck and see if it's a PUT or POST
        let method = 'POST';
        let response = await fetch(`${url}?ref=${branchOrTag}`, {
            method: 'GET',
            headers: {
                'PRIVATE-TOKEN': personalAccessToken
            },
        });

        if (response.ok) {
            method = 'PUT';
        } else if (response.status === 404) {
            method = 'POST';
        } else {
            const error = await response.json();
            throw new Error(`Failed to check file: ${error.message}`);
        }

        response = await fetch(url, {
            method,
            body: JSON.stringify({
                branch: branchOrTag,
                content: content,
                commit_message: 'Add file via API',
            }),
            headers: {
                'Content-Type': 'application/json',
                'PRIVATE-TOKEN': personalAccessToken
            }
        });
        if (!response.ok) {
            console.error(`Failed to upload file to GitLab: ${url}`);
            throw new Error(`Failed to upload file to GitLab: ${response.statusText}`);
        }
    },
    // Upload a text file to a GitLab repository
    fetchFile: async (
        repositoryId: string,
        filePath: string,
        branchOrTag: string,
        personalAccessToken: string
    ): Promise<any> => {
        const url = `https://gitlab.ea.com/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/files/${encodeURIComponent(filePath)}`;
        console.log(url)
        let response = await fetch(`${url}?ref=${branchOrTag}`, {
            method: 'GET',
            headers: {
                'PRIVATE-TOKEN': personalAccessToken
            },
        });

        if (response.ok) {
            return response.json();
        } else {
            const error = await response.json();
            throw new Error(`Failed to check file: ${error.message}`);
        }
    },

    /**
     * 
     * @param repositoryId 
     * @param folderPath 
     * @param branch 
     * @param personalAccessToken 
     * @returns 
     */
    getFilesFromFolder: async (
        repositoryId: string,
        folderPath: string,
        branch: string,
        personalAccessToken: string
    ): Promise<any> => {
        const endpoint = `https://gitlab.ea.com/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/tree?path=${encodeURIComponent(folderPath)}&ref=${branch}`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'PRIVATE-TOKEN': personalAccessToken
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch folder content');
        }

        const files = await response.json();

        return files.filter((file: any) => file.type === 'blob').map((file: any) => file.path); // Filter to get only files, not directories
    },
    

    /**
     * getSubgroupIdByName
     * @param search 
     * @param personalAccessToken 
     * @returns 
     */
    getSubgroupIdByName: async (
        search: string,
        personalAccessToken: string,
    ): Promise<string> => {
        const apiUrl = `https://gitlab.ea.com/api/v4/groups?search=${encodeURIComponent(search)}`;

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${personalAccessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Could not fetch the groups: ${await response.text()}`);
        }

        const groups = await response.json();
        const group = groups[0];

        if (!group) {
            throw new Error('Group not found');
        }

        return group.id;
    },

    /**
     * getSubgroupIdByName
     * @param search 
     * @param personalAccessToken 
     * @returns 
     */
    getGroupNameByGroupId: async (
        groupId: string,
        personalAccessToken: string,
    ): Promise<string> => {
        const apiUrl = `https://gitlab.ea.com/api/v4/groups/${groupId}`;

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${personalAccessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Could not fetch the groups: ${await response.text()}`);
        }

        const group = await response.json();
        if (!group) {
            throw new Error('Group not found');
        }

        return group.name;
    },

    /**
     * createGitlabRepoCiVar
     * @param projectId 
     * @param personalAccessToken 
     * @param varKey 
     * @param varValue 
     * @param masked 
     */
    createGitlabRepoCiVar: async (
        projectId: string,
        personalAccessToken: string,
        varKey: string,
        varValue: string,
        masked: boolean
    ): Promise<void> => {
        const response = await fetch(`https://gitlab.ea.com/api/v4/projects/${projectId}/variables`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${personalAccessToken}`,
            },
            body: JSON.stringify({
                key: varKey,
                value: varValue,
                masked: masked,
            })
        });

        if (!response.ok) {
            throw new Error(`Could not create the repo variable: ${await response.text()}`);
        }
    },

    /**
     * createGitlabRepo
     * @param options 
     * @param personalAccessToken 
     * @returns 
     */
    createGitlabRepo: async (
        options: CreateRepoOptions,
        personalAccessToken: string
    ): Promise<any> => {
        let body = null
        if (!options.namespaceId || options.namespaceId == null || options.namespaceId == "") {
            body = JSON.stringify({
                name: options.name,
                description: options.description,
                visibility: options.visibility,
            })
        } else {
            body = JSON.stringify({
                name: options.name,
                namespace_id: options.namespaceId,
                description: options.description,
                visibility: options.visibility,
            })
        }

        /**
         * Create a new GitLab repository
         */
        const response = await fetch(`https://gitlab.ea.com/api/v4/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${personalAccessToken}`,
            },
            body: body,
        });

        if (!response.ok) {
            throw new Error(`Could not create the repository: ${await response.text()}`);
        }

        let gitResponse = await response.json()

        // return gitResponse.http_url_to_repo
        return gitResponse
    },

    /**
     * deleteRepo
     * @param groupName 
     * @param repoName 
     * @param personalAccessToken 
     */
    deleteRepoIfExist: async (
        groupName: string, 
        repoName: string, 
        personalAccessToken: string
    ) => {
        const searchString = `${groupName}/${repoName}`;
        const apiUrl = `https://gitlab.ea.com/api/v4/search?scope=projects&search=${encodeURIComponent(searchString)}`;
        let response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${personalAccessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Could not fetch the groups: ${await response.text()}`);
        }

        const allProjects = await response.json();
        const targetProjectBlock = allProjects.find((project: { path_with_namespace: string; }) => project.path_with_namespace == searchString || project.path_with_namespace.endsWith("/" + searchString));
        if(targetProjectBlock) {
            response = await fetch(`https://gitlab.ea.com/api/v4/projects/${targetProjectBlock.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${personalAccessToken}`,
                }
            });
    
            if (!response.ok) {
                throw new Error(`Could not delete the repository: ${await response.text()}`);
            }
        }
    }
};

// Typescript interface for Create Repository options
export interface CreateRepoOptions {
    name: string;
    namespaceId?: string; // Group or Sub-group ID where you want to create the project
    description?: string;
    visibility: string;
}