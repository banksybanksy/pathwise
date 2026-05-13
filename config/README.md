# Config / deployment snippets

## Nginx: proxy API to Node

File **`nginx-api-proxy.conf`** contains a `location /api/` block that forwards requests to the Pathwise Node app on port 3000.

### How to apply on EC2

1. SSH into the server.
2. Edit the Nginx site config:
   ```bash
   sudo nano /etc/nginx/sites-available/default
   ```
3. Find the `server { ... }` block that uses `root /var/www/html;` (or your site root).
4. **Inside** that block, add the contents of `nginx-api-proxy.conf` (the `location /api/ { ... }` block). Put it **before** any `location /` block.
5. Test and reload:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```
6. In the browser, open the test page and use the search form; `/api/search` should return JSON.
