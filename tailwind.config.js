// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    container: { center: true },
    extend: {
      // 1) الألوان (Brand + System)
      colors: {
        // من هوية سِلّة:
        primary: {
          DEFAULT: "#004e5c", // --color-primary
          900: "#003c47", // --color-primary-darker
          800: "#00414d",
          700: "#004D5A",
        },
        secondary: {
          DEFAULT: "#76E8CD", // --color-secondary
          50: "#CFF7EE",
          100: "#BAF3E6",
          200: "#96EDD9",
        },
        // رماديات
        gray: {
          25: "#f8f8f8",
          50: "#fcfcfc",
          100: "#f2f5f7",
          200: "#eeeeee",
          300: "#dddddd",
          400: "#bbbbbb",
          500: "#cccccc",
          600: "#999999",
          700: "#666666",
          800: "#444444",
          900: "#333333",
        },
        // لوحات النظام الجاهزة (Material-like) لاستخدامات سريعة
        info: "#00bcd4",
        success: "#4caf50",
        warning: "#ff5722",
        danger: "#f55157",
      },
      // 2) الحواف
      borderRadius: {
        DEFAULT: "8px", // --b-radius
        md: "8px",
        sm: "4px", // --b-radius-sm
      },
      // 3) الخط
      fontFamily: {
        sans: ['"PingARLT"', "ui-sans-serif", "system-ui"],
      },
      // 4) الظلال (ناعمة للوحات)
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.06)",
        hover: "0 2px 8px rgba(0,0,0,.08)",
      },
    },
  },
  plugins: [],
};
