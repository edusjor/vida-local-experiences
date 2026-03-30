const prismaConfig = {
  adapter: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL ?? '',
  },
};

export default prismaConfig;