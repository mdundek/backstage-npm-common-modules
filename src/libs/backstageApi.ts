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
        const data:any = await response.json();
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
        const data:any = await response.json();
        return data.items;
    },
    // Find entries with dependencies to this component
    findSystemNeotekTypedComponents: async (
        type: string,
        system: string,
        token: string,
    ) => {
        const url = `http://localhost:7007/api/catalog/entities/by-query?filter=metadata.annotations.neotek.ea.com/component-type=${type},spec.system=${system}`;
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
        const data:any = await response.json();
        return data.items;
    },
    // Find entries with dependencies to this component
    findAxionInstancesForCluster: async (
        clusterRef: string,
        token: string,
    ) => {
        const url = `http://localhost:7007/api/catalog/entities/by-query?filter=metadata.annotations.neotek.ea.com/component-type=axion-instance,relations.dependsOn=component:${clusterRef}`;
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
        const data:any = await response.json();
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
    unregisterLocation: async (
        kind: string,
        namespace: string,
        name: string,
        token: string,
    ) => {
        let response = await fetch(`http://localhost:7007/api/catalog/locations/by-entity/${kind}/${namespace}/${name}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            console.log(response);
            console.error(`Failed to lookup entity: ${name}`);
            throw new Error(`Failed to lookup entity: ${name}`);
        }

        const data:any = await response.json();

        response = await fetch(`http://localhost:7007/api/catalog/locations/${data.id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            console.log(response);
            console.error(`Failed to delete entity location from catalog: ${name}`);
            throw new Error(`Failed to delete entity location from catalog: ${name}`);
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