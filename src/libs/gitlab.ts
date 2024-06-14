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
    getFilesFromFolder: async(
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
    }
};