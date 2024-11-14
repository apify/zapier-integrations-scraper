import axios from 'axios';
import { Actor } from 'apify';
import axiosRetry from 'axios-retry';

await Actor.init();

const BASE_URL = 'https://zapier.com/explore-api';
const DEFAULT_KV_STORE_KEY = 'zapier';

interface Input {
    keyValueStore: string;
    key: string;
    pageSize: number;
    maxConcurrentRequests: number;
}

interface ZapierIntegrationItem {
    name: string;
    url: string;
    icon: string;
}

interface ZapierIntegrationsResponse {
    data: {
        appCategory: {
            apps: {
                results: [{
                    name: string;
                    logo: {
                        mainUrl: string;
                    };
                    profileUrl: string;
                }]
                count: number;
            }
        }
    }
}

const input = await Actor.getInput<Input>();
if (!input) throw new Error('Input is missing!');

const {
    keyValueStore,
    key = DEFAULT_KV_STORE_KEY,
    pageSize = 25,
    maxConcurrentRequests = 5,
} = input;

// Configure axios-retry
axiosRetry(axios, {
    retries: 3, // Number of retry attempts
    retryDelay: (retryCount) => {
        return retryCount * 1000; // Exponential backoff (1000ms, 2000ms, 3000ms, ...)
    },
    retryCondition: (error) => {
        // Retry on network errors or 5xx responses
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status || 200) >= 500;
    },
});

const body = (offset: number, limit: number) => ({
    operationName: 'CategoryAppsBFFQuery',
    variables: {
        categorySlug: 'all',
        offset,
        limit,
        orderBy: 'POPULARITY',
        filterBy: '',
    },
    query: `
        query CategoryAppsBFFQuery(
            $categorySlug: String = "all",
            $limit: Int = 10,
            $offset: Int = 0,
            $orderBy: AppSortOrder,
            $filterBy: String
        ) {
            appCategory: appCategoryWithSlug(slug: $categorySlug) {
                apps(
                    orderBy: $orderBy
                    limit: $limit
                    offset: $offset
                    additionalCategorySlug: $filterBy
                ) {
                    results {
                        id
                        name
                        logo {
                            mainUrl
                        }
                        description
                        slug
                        profileUrl
                    }
                    count
                }
            }
        }
`,
});

const loadStats = async () => {
    const response = await axios.post<ZapierIntegrationsResponse>(
        BASE_URL,
        body(0, 1),
        {
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    return response.data.data.appCategory.apps.count;
};

const loadPage = async (offset: number): Promise<ZapierIntegrationItem[]> => {
    const response = await axios.post<ZapierIntegrationsResponse>(
        BASE_URL,
        body(offset, pageSize),
        {
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    return response.data.data.appCategory.apps.results.map((entity) => ({
        name: entity.name,
        url: entity.profileUrl,
        icon: entity.logo.mainUrl,
    }));
};

// Utility to run promises with limited concurrency
const asyncPool = async <T>(limit: number, tasks: (() => Promise<T>)[]): Promise<T[]> => {
    const executing: Promise<void>[] = [];
    const results: T[] = [];

    for (const task of tasks) {
        // Wrap each task in a Promise that captures its result
        const p = task().then((result) => {
            results.push(result);
        }).finally(() => {
            // eslint-disable-next-line
            executing.splice(executing.indexOf(p), 1);
        });

        executing.push(p);

        if (executing.length >= limit) {
            // Wait for the first task to complete if we reach the concurrency limit
            await Promise.race(executing);
        }
    }

    // Wait for all remaining tasks to complete
    await Promise.all(executing);

    return results;
};

const totalItems = await loadStats();
const totalPages = Math.ceil(totalItems / pageSize);

console.log(`Total items: ${totalItems}, Total pages: ${totalPages}`);

// Generate the tasks for each page load
const tasks = Array.from({ length: totalPages }, (_, i) => () => loadPage(i * pageSize));

// Run tasks with concurrency limit
const pages = await asyncPool(maxConcurrentRequests, tasks);

const items = pages.flat();

// Remove duplicates based on `url`
const uniqueItems = Array.from(
    new Map(items.map((item) => [item.url, item])).values(),
);

const store = await Actor.openKeyValueStore(keyValueStore);
await store.setValue(key, uniqueItems);

console.log(`Stored ${uniqueItems.length} integrations`);

await Actor.exit();
