"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backstageApi = void 0;
exports.backstageApi = {
    // Upload a text file to a GitLab repository
    getEntitiesByRef: (refs, token) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `http://localhost:7007/api/catalog/entities/by-refs`;
        const response = yield fetch(url, {
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
    }),
    // Upload a text file to a GitLab repository
    getEntityUid: (kind, namespace, name, token) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `http://localhost:7007/api/catalog/entities/by-name/${kind}/${namespace}/${name}`;
        const response = yield fetch(url, {
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
        const data = yield response.json();
        return data.metadata.uid;
    }),
    // Find entries with dependencies to this component
    findDependantComponents: (name, token) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `http://localhost:7007/api/catalog/entities/by-query?filter=kind=component,relations.dependsOn=component:default/${name}`;
        const response = yield fetch(url, {
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
        const data = yield response.json();
        return data.items;
    }),
    // Find entries with dependencies to this component
    findSystemNeotekTypedComponents: (type, system, token) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `http://localhost:7007/api/catalog/entities/by-query?filter=metadata.annotations.neotek.ea.com/component-type=${type},spec.system=${system}`;
        const response = yield fetch(url, {
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
        const data = yield response.json();
        return data.items;
    }),
    // Find entries with dependencies to this component
    findAxionInstancesForCluster: (clusterRef, token) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `http://localhost:7007/api/catalog/entities/by-query?filter=metadata.annotations.neotek.ea.com/component-type=axion-instance,relations.dependsOn=component:${clusterRef}`;
        const response = yield fetch(url, {
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
        const data = yield response.json();
        return data.items;
    }),
    // Upload a text file to a GitLab repository
    deleteByUid: (uid, token) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `http://localhost:7007/api/catalog/entities/by-uid/${uid}`;
        const response = yield fetch(url, {
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
    }),
    addNewLocation: (catalogYamlPath, token) => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield fetch("http://localhost:7007/api/catalog/locations", {
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
        yield exports.backstageApi.refreshLocations(token);
    }),
    unregisterLocation: (kind, namespace, name, token) => __awaiter(void 0, void 0, void 0, function* () {
        let response = yield fetch(`http://localhost:7007/api/catalog/locations/by-entity/${kind}/${namespace}/${name}`, {
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
        const data = yield response.json();
        response = yield fetch(`http://localhost:7007/api/catalog/locations/${data.id}`, {
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
        yield exports.backstageApi.refreshLocations(token);
    }),
    refreshLocations: (token) => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield fetch("http://localhost:7007/api/catalog/refresh", {
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
    })
};
