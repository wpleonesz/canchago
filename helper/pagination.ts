interface PaginationQuery {
	page?: number;
	pageSize?: number;
}

interface PaginationMeta {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

export const normalizePagination = (
	query: PaginationQuery,
): { skip: number; take: number; meta: (total: number) => PaginationMeta } => {
	const page = Math.max(1, query.page ?? 1);
	const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 20));

	return {
		skip: (page - 1) * pageSize,
		take: pageSize,
		meta: (total: number) => ({
			page,
			pageSize,
			total,
			totalPages: Math.ceil(total / pageSize),
		}),
	};
};
