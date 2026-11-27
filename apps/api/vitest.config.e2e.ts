import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Các file e2e dùng chung một DB thật → chạy lần lượt để dữ liệu test không chồng nhau.
    fileParallelism: false,
  },
});
