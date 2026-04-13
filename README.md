This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
"# tours-sys" 

## Deploy En VPS Con Docker

### 1) Requisitos
- Docker y Docker Compose instalados en el VPS.
- Archivo `.env` con variables de produccion.

### 2) Configurar Base De Datos Externa
- Usa tu `DATABASE_URL` de Neon/RDS/etc en `.env`.
- El archivo `docker-compose.vps.yml` esta preparado para DB externa (no levanta Postgres local).

### 3) Levantar Servicios

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

La app queda publicada en `http://TU_IP:3003`.

### 4) Comandos Utiles

```bash
docker compose -f docker-compose.vps.yml logs -f app
docker compose -f docker-compose.vps.yml restart app
docker compose -f docker-compose.vps.yml down
```

### 5) Notas Importantes
- `docker/entrypoint.sh` ejecuta por defecto:
	- `prisma generate`
	- `prisma migrate deploy`
- `RUN_DB_PUSH` esta en `false` por defecto para evitar cambios no controlados en produccion.
- `uploads` se monta como volumen bind (`./uploads:/app/uploads`) para conservar archivos entre despliegues.
