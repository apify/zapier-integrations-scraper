## Zapier Integrations Scraper

This Apify Actor scrapes the list of integrations from the Zapier Integrations page.
The data are stored in a key-value store as JSON list under the defined key.

## Input schema

The input schema defines the following properties:

- **keyValueStore**: The id of the key-value store to insert results into. If not provided, the results will be stored in the default key-value store.
- **key**: The key under which the results will be stored in the key-value store.
- **pageSize**: The number of items to get in one request.
- **maxConcurrentRequests**: The number of concurrent requests to make to the server.

## Example input

```json
{
    "keyValueStore": "my-key-value-store",
    "key": "zapier",
    "pageSize": 25,
    "maxConcurrentRequests": 5
}
```

## Example output

```json
[
    {
        "name": "Google Sheets",
        "url": "https://zapier.com/apps/google-sheets/integrations",
        "icon": "https://zapier-images.imgix.net/storage/services/8913a06feb7556d01285c052e4ad59d0.png?auto=format%2Ccompress&ixlib=python-3.0.0&q=50"
    },
    {
        "name": "Gmail",
        "url": "https://zapier.com/apps/gmail/integrations",
        "icon": "https://zapier-images.imgix.net/storage/services/1afcb319c029ec5da10efb593b7159c8.png?auto=format%2Ccompress&ixlib=python-3.0.0&q=50"
    }
]
```
