# Preview Project Workflow

This workflow details the exact commands needed to start the preview server and test the SignatureCRM project.

## Prerequisites
- Dependencies installed (`npm install` completed)
- Node.js version 20 or higher
- Firebase configuration (optional for full functionality)

## Steps

### 1. Start Development Server
Run the Next.js development server:
```bash
npm run dev
```
This will start the server with hot reload enabled. The command uses `npx next dev` as defined in `package.json`.

### 2. Access the Preview
Once the server starts, it will output something like:
```
▲ Next.js 14.2.35
- Local:        http://localhost:3000
- Environments: .env
```
Open your browser and navigate to `http://localhost:3000`.

### 3. Verify Server Health
Check that the server is responding correctly:
- You can use `curl` or `wget` to test:
  ```bash
  curl -I http://localhost:3000
  ```
  Expected response: `HTTP/1.1 200 OK` (or `500` if there are runtime errors; see troubleshooting).

### 4. Preview Configuration (Antigravity)
If you are using Antigravity, the preview is configured in `.idx/dev.nix` with:
```nix
previews = {
  enable = true;
  previews = {
    web = {
      command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
      manager = "web";
    };
  };
};
```
This ensures the preview server starts with the correct port and hostname when launched from Antigravity.

### 5. Troubleshooting
- **Port already in use**: If port 3000 is occupied, you can change the port by setting `PORT` environment variable:
  ```bash
  PORT=3001 npm run dev
  ```
- **Firebase errors**: If the page shows a 500 error related to Firebase, ensure your Firebase environment variables are set in `.env`. The app may still start but certain features may not work.
- **Slow compilation**: The first startup may take longer due to TypeScript compilation and webpack caching. Subsequent starts will be faster.
- **Missing icons**: The project expects PWA icons in `public/icons/`. If missing, you can generate them or ignore the 404 warnings.

### 6. Stopping the Preview
Press `Ctrl+C` in the terminal where the dev server is running to stop the preview.

## Notes
- The development server supports hot module replacement (HMR) for quick UI updates.
- The preview is optimized for local development; for production-like preview, use `npm start` after building.
- The project includes PWA features; service worker is registered automatically in development mode.