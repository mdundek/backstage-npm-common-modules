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
    // Find entries with dependencies to this component
    findDependantComponents: async (
        name: string,
        token: string,
    ) => {
        const url = `http://localhost:7007/api/catalog/entities/by-query?filter=kind=component,relations.dependsOn=component:default/${name}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            console.error(`Failed to find components: ${url}`);
            throw new Error(`Failed to find components: ${response.statusText}`);
        }
        const data = await response.json();
        return data.items;
    },
    // Find entries with dependencies to this component
    findSystemNeotekTypedComponents: async (
        type: string,
        token: string,
    ) => {
        const url = `http://localhost:7007/api/catalog/entities/by-query?filter=metadata.annotations.neotek.ea.com/component-type=${type}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            console.error(`Failed to find components: ${url}`);
            throw new Error(`Failed to find components: ${response.statusText}`);
        }
        const data = await response.json();
        return data.items;
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
    addNewLocation: async (
        catalogYamlPath: string,
        token: string,
    ) => {
        const response = await fetch("http://localhost:7007/api/catalog/locations", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                type: "url",
                target: `${process.env.GITLAB_BACKSTAGE_CATALOG_BASE_URL}${catalogYamlPath}`
            }),
        });

        if (!response.ok) {
            console.error(`Failed to add new URL: ${catalogYamlPath}`);
            throw new Error(`Failed to add new URL: ${catalogYamlPath}`);
        }

        await backstageApi.refreshLocations(token);
    },
    refreshLocations: async (
        token: string,
    ) => {
        const response = await fetch("http://localhost:7007/api/catalog/refresh", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                entityRef: "location:default/backstage-poc-resources",
                authorizationToken: token,
            }),
        });

        if (!response.ok) {
            console.error(`Failed to refresh locations`);
            throw new Error(`Failed to refresh locations`);
        }
    }
};