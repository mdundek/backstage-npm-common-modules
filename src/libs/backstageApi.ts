export const backstageApi = {
    // Upload a text file to a GitLab repository
    getEntitiesByRef: async (
        refs: any,
        token: string,
    ): Promise<any> => {
        const url = `http://localhost:7007/api/catalog/entities/by-refs`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                entityRefs: refs,
                fields: []
            }),
        });

        if (!response.ok) {
            console.error(`Failed to fetch file from GitLab: ${url}`);
            throw new Error(`Failed to fetch file from GitLab: ${response.statusText}`);
        }
        return response.json();
    },
};