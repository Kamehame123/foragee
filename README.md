# Default Project

A small collection of browser games and experiments.

## Foragee 🍃

A cozy foraging game: gather, craft, trade, farm, and make the homestead yours. It runs entirely in the browser with no build step or dependencies.

- **Play online:** `https://<your-username>.github.io/<repo>/` (once GitHub Pages is enabled)
- **Play locally:** open `Foragee/index.html`, or serve the folder with `npx serve Foragee`
- **Docs:** [Foragee/README.md](Foragee/README.md)

### Deploying Foragee

The workflow in `.github/workflows/pages.yml` publishes the contents of `Foragee/` to GitHub Pages on every push to `main`, so the site root is the game itself.

1. Create a repository on GitHub and push this project:

   ```sh
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```

2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The **Deploy Foragee to GitHub Pages** workflow runs on the push (or start it manually from the **Actions** tab).
4. When it finishes, the game is live at `https://<your-username>.github.io/<repo>/`.

Any later push to `main` redeploys automatically.
