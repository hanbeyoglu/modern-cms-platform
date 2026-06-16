# Demo Data

Use this dataset to make the CMS dashboard and content modules feel populated during sales demos.

## Run

```bash
pnpm db:seed
pnpm demo:seed
```

`pnpm db:seed` creates the base tenants, malls, roles, permissions, capabilities, and demo users. `pnpm demo:seed` adds richer demo content with:

- Global stores and store categories
- Mall store assignments for the existing demo malls
- Published and scheduled campaigns
- Upcoming events
- Slider groups and slider items
- Active popups
- Location services
- Static pages
- Placeholder media records linked to the content

The root script delegates to the API package:

```bash
pnpm --filter @modern-cms/api demo:seed
```

## Demo Users

- `superadmin@example.com` / `SuperAdmin123!`
- `groupadmin@example.com` / `GroupAdmin123!`
- `mallmanager@example.com` / `MallManager123!`

## Demo Tenants And Malls

- Emaar AVM
  - Emaar AVM
- Mall Group
  - Mall of İstanbul
  - Mall of Bursa

The demo seed targets those existing demo malls. If it cannot find them, run `pnpm db:seed` first.

## Sales Demo Flow

1. Log in as `groupadmin@example.com`.
2. Select `Mall Group`, then switch between `Mall of İstanbul` and `Mall of Bursa`.
3. Open the dashboard and point out live KPIs: active stores, campaigns, events, sliders, popups, media, and services.
4. Use "Yaklaşan içerikler" to show the publishing calendar story.
5. Open Campaigns, Events, Sliders, Popups, Media, and Services from the dashboard quick actions.
6. Switch to `mallmanager@example.com` to show mall-scoped access for Mall of İstanbul.
7. Use `superadmin@example.com` only when demonstrating platform administration.
