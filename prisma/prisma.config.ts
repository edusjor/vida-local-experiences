export default {
  adapter: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL || 'postgresql://trade_user:trade_pass_123@localhost:5432/trade?schema=public',
  },
};