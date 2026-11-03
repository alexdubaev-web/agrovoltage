export default {
  layout: "layouts/base.njk",
  eleventyComputed: {
    breadcrumbs: () => [
      { name: "Главная", url: "/" },
      { name: "Корзина", url: "/korzina/" },
    ],
  },
};
