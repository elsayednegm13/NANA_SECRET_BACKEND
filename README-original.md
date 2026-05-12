# NANA SECRET Website

Modern responsive website for **NANA SECRET**, a home textiles and blankets company based in Egypt.  
The project includes bilingual Arabic/English pages, a polished visual identity, interactive news, team profiles, contact sections, and a searchable product catalog.

![NANA SECRET](assets/images/logo.webp)

## Overview

This website was built as a clean corporate presence and product catalog for NANA SECRET.  
It focuses on modern UI, smooth animations, responsive layouts, and easy browsing across desktop, tablet, and mobile devices.

## Features

- Arabic and English language support
- Responsive layout for all screen sizes
- Homepage hero slider
- Animated counters and company highlights
- About page for company profile and capabilities
- Team page with leadership cards
- Products page with:
  - Search by name or category
  - Category filtering
  - A-Z / Z-A sorting
  - Grid and list views
  - 3, 4, or 5-column grid display
- News page with articles, gallery, and video link
- Admin dashboard for adding, editing, deleting, exporting, and importing news
- Contact page with phone, email, location, WhatsApp, Facebook, and YouTube
- Brand colors inspired by gold and orange identity

## Tech Stack

- HTML5
- CSS3
- JavaScript

## Pages

| Page | File |
| --- | --- |
| Home | `index.html` |
| About | `about.html` |
| Team | `team.html` |
| Products | `products.html` |
| News | `news.html` |
| Contact | `contact.html` |
| Admin Dashboard | `admin.html` |

## Admin Dashboard

Open `admin.html` to manage dynamic news.

Default login:

```text
Username: ADMIN
Password: 123
```

News added from the dashboard is stored in the browser local storage and appears automatically on the homepage and news page.

## Project Structure

```text
nana-secret-site/
├── index.html
├── about.html
├── team.html
├── products.html
├── news.html
├── contact.html
├── admin.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── main.js
│   │   ├── news-store.js
│   │   ├── admin.js
│   │   └── products.js
│   └── images/
│       ├── logo.webp
│       ├── product-placeholder.svg
│       └── ...
└── README.md
```

## Run Locally

Open `index.html` directly in the browser, or run a local server:

```bash
npx serve .
```

Then open the local URL shown in the terminal.

## Customization

- Replace team placeholder images in `assets/images/team-*.svg`
- Replace product placeholder image in `assets/images/product-placeholder.svg`
- Edit product data in `assets/js/products.js`
- Update colors and layout in `assets/css/styles.css`

## Contact

**NANA SECRET**  
Third Industrial Area, 10th of Ramadan, Egypt  
Email: `info@nanasecret.com.eg`  
Phone: `+201033312626`  
WhatsApp: `01091597606`

## License

This project is prepared for NANA SECRET corporate website usage.
