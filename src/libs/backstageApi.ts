export const backstageApi = {
    // Upload a text file to a GitLab repository
    getEntitiesByRef: async (
        refs: any,
        token: string,
    ) => {
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
    // Upload a text file to a GitLab repository
    getEntityUid: async (
        kind: string,
        namespace: string,
        name: string,
        token: string,
    ) => {
        const url = `http://localhost:7007/api/catalog/entities/by-name/${kind}/${namespace}/${name}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch file from GitLab: ${url}`);
            throw new Error(`Failed to fetch file from GitLab: ${response.statusText}`);
        }
        const data = await response.json();
        return data.metadata.uid;
    },
    // Upload a text file to a GitLab repository
    deleteByUid: async (
        uid: string,
        token: string,
    ) => {
        const url = `http://localhost:7007/api/catalog/entities/by-uid/${uid}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch file from GitLab: ${url}`);
            throw new Error(`Failed to fetch file from GitLab: ${response.statusText}`);
        }
    },
};