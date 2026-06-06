const MAX_LIMIT = 100;

export function getPagination(
  page: number = 1,
  limit: number = 10,
): { skip: number; take: number } {
  const take = Math.min(Math.max(1, limit), MAX_LIMIT);
  const skip = (Math.max(1, page) - 1) * take;
  return { skip, take };
}
