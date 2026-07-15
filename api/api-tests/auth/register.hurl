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
[Asserts]
duration < 1000
header "Content-Type" contains "application/json"
header "Cache-Control" == "no-store"
cookie "access_token" exists
cookie "refresh_token" exists
jsonpath "$.access_token" exists
jsonpath "$.refresh_token" exists
jsonpath "$.user.email" == "{{register_email}}"
jsonpath "$.user.display_name" == "{{register_display_name}}"
jsonpath "$.user.id" exists
jsonpath "$.user.session_id" exists
