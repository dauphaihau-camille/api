POST {{base_url}}/v1/auth/register
Content-Type: application/json
```json
{
  "email": "{{register_email}}",
  "password": "{{register_password}}",
  "display_name": "{{register_display_name}}"
}
```
HTTP 201
[Captures]
user_id: jsonpath "$.user.id"

POST {{base_url}}/v1/workspaces
Content-Type: application/json
```json
{
  "name": "{{workspace_name}}",
  "slug": "{{workspace_slug}}",
  "description": "{{workspace_description}}"
}
```
HTTP 201
[Captures]
workspace_id: jsonpath "$.id"
workspace_version: jsonpath "$.version"
workspace_slug_current: jsonpath "$.slug"
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$.current_user_role" == "owner"
jsonpath "$.name" == "{{workspace_name}}"
jsonpath "$.slug" == "{{workspace_slug}}"

GET {{base_url}}/v1/me/workspaces
HTTP 200
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$[0].id" exists

GET {{base_url}}/v1/workspaces/{{workspace_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{workspace_id}}"
jsonpath "$.slug" == "{{workspace_slug_current}}"
jsonpath "$.description" == "{{workspace_description}}"

PATCH {{base_url}}/v1/workspaces/{{workspace_slug_current}}
Content-Type: application/json
```json
{
  "version": {{workspace_version}},
  "name": "{{workspace_updated_name}}",
  "slug": "{{workspace_updated_slug}}",
  "description": "{{workspace_updated_description}}"
}
```
HTTP 200
[Captures]
workspace_version_updated: jsonpath "$.version"
workspace_slug_updated: jsonpath "$.slug"
[Asserts]
jsonpath "$.id" == "{{workspace_id}}"
jsonpath "$.name" == "{{workspace_updated_name}}"
jsonpath "$.slug" == "{{workspace_updated_slug}}"
jsonpath "$.description" == "{{workspace_updated_description}}"

POST {{base_url}}/v1/documents
Content-Type: application/json
```json
{
  "workspace_id": "{{workspace_id}}",
  "title": "{{document_title}}",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "{{document_content_text}}"
        }
      ]
    }
  ]
}
```
HTTP 201
[Captures]
document_id: jsonpath "$.id"
document_version: jsonpath "$.version"
[Asserts]
jsonpath "$.workspace_id" == "{{workspace_id}}"
jsonpath "$.title" == "{{document_title}}"

GET {{base_url}}/v1/workspaces/{{workspace_id}}/documents
HTTP 200
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$.private_documents[0].id" == "{{document_id}}"

PATCH {{base_url}}/v1/documents/{{document_id}}
Content-Type: application/json
```json
{
  "version": {{document_version}},
  "title": "{{document_updated_title}}",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "{{document_search_query}}"
        }
      ]
    }
  ]
}
```
HTTP 200
[Captures]
document_version_updated: jsonpath "$.version"
[Asserts]
jsonpath "$.id" == "{{document_id}}"
jsonpath "$.title" == "{{document_updated_title}}"

GET {{base_url}}/v1/workspaces/{{workspace_id}}/search/documents?q={{document_search_query}}
HTTP 200
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$[0].document_id" == "{{document_id}}"
jsonpath "$[0].title" == "{{document_updated_title}}"

POST {{base_url}}/v1/documents/{{document_id}}/publish
HTTP 201
[Captures]
published_document_id: jsonpath "$.published_document_id"
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$.document_id" == "{{document_id}}"
jsonpath "$.published_document_id" exists
jsonpath "$.public_path" exists

GET {{base_url}}/v1/documents/{{document_id}}/publish
HTTP 200
[Asserts]
jsonpath "$.document_id" == "{{document_id}}"
jsonpath "$.published_document_id" == "{{published_document_id}}"

GET {{base_url}}/v1/published/{{published_document_id}}
HTTP 200
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$.id" == "{{document_id}}"
jsonpath "$.title" == "{{document_updated_title}}"

POST {{base_url}}/v1/documents/{{document_id}}/archive
Content-Type: application/json
```json
{
  "version": {{document_version_updated}}
}
```
HTTP 200
[Captures]
document_archived_version: jsonpath "$.version"
[Asserts]
jsonpath "$.id" == "{{document_id}}"
jsonpath "$.archived_at" isIsoDate

GET {{base_url}}/v1/workspaces/{{workspace_id}}/documents/archived
HTTP 200
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$.items[0].id" == "{{document_id}}"
jsonpath "$.items[0].title" == "{{document_updated_title}}"

POST {{base_url}}/v1/documents/{{document_id}}/restore
Content-Type: application/json
```json
{
  "version": {{document_archived_version}}
}
```
HTTP 200
[Captures]
document_restored_version: jsonpath "$.version"
[Asserts]
jsonpath "$.id" == "{{document_id}}"

DELETE {{base_url}}/v1/documents/{{document_id}}/publish
HTTP 200
[Asserts]
jsonpath "$.document_id" == "{{document_id}}"

GET {{base_url}}/v1/published/{{published_document_id}}
HTTP 404
