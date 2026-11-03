// /katalog/index.json — для поиска и проверки корзины (interfaces.md §4).
export default {
  layout: null,
  eleventyComputed: {
    catalogIndex: (data) =>
      (data.collections.products || []).map((p) => ({
        slug: p.slug,
        title: p.data.title,
        sku: p.data.sku,
        category: p.data.category,
        price: typeof p.data.price === "number" ? p.data.price : null,
        inStock: p.data.inStock === true,
        url: p.url,
        image: (p.data.images || []).find(Boolean) || "",
      })),
  },
};
