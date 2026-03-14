import { config, fields, singleton } from '@keystatic/core';

// ---------------------------------------------------------------------------
// Image helper — all uploads land in the same directory as Decap
// ---------------------------------------------------------------------------
const img = (label: string) =>
  fields.image({
    label,
    directory: 'assets/images/uploads',
    publicPath: '/assets/images/uploads/',
  });

// ---------------------------------------------------------------------------
// Reusable CTA link block
// ---------------------------------------------------------------------------
const ctaFields = {
  ctaLabel: fields.text({ label: 'Button Text' }),
  ctaUrl: fields.url({ label: 'Button URL' }),
};

// ---------------------------------------------------------------------------
// export default config
// ---------------------------------------------------------------------------
export default config({
  // -------------------------------------------------------------------------
  // Storage: 'cloud' uses Keystatic Cloud for auth and hosted admin UI.
  // Replace 'your-team/your-project' with the slug from keystatic.cloud
  // after creating your project there.
  // -------------------------------------------------------------------------
  storage: {
    kind: 'cloud',
  },
  cloud: {
    project: 'your-team/your-project', // ← replace after keystatic.cloud setup
  },

  // =========================================================================
  // SINGLETONS
  // Each singleton maps to one JSON file in the repo.
  // =========================================================================
  singletons: {

    // -----------------------------------------------------------------------
    // 1. SITE CONTENT  →  content/site.json
    // All homepage sections, global settings, checkout/success copy.
    // -----------------------------------------------------------------------
    siteContent: singleton({
      label: 'Site Content',
      path: 'content/site',
      format: { data: 'json' },
      schema: {

        // — Hero section —
        hero: fields.object({
          label: 'Hero Section',
          fields: {
            title: fields.text({ label: 'Headline' }),
            tagline: fields.text({ label: 'Tagline' }),
            proofText: fields.text({ label: 'Social Proof Text', validation: { isRequired: false } }),
            imageUrl: fields.url({ label: 'Background Image URL', validation: { isRequired: false } }),
            ctaPrimaryLabel: fields.text({ label: 'Primary Button Text' }),
            ctaPrimaryUrl: fields.url({ label: 'Primary Button URL' }),
            ctaSecondaryLabel: fields.text({ label: 'Secondary Button Text' }),
            ctaSecondaryUrl: fields.text({ label: 'Secondary Button URL' }),
          },
        }),

        // — Announcement banner (top bar) —
        banner: fields.object({
          label: 'Announcement Banner',
          fields: {
            emoji: fields.text({ label: 'Emoji (optional)', validation: { isRequired: false } }),
            strongText: fields.text({ label: 'Bold Prefix', description: "e.g. 'Next Event:'" }),
            text: fields.text({ label: 'Message' }),
            ctaLabel: fields.text({ label: 'Link Text' }),
            ctaUrl: fields.url({ label: 'Link URL' }),
          },
        }),

        // — Tickets & Merch section —
        tickets: fields.object({
          label: 'Tickets & Merch Cards',
          fields: {
            ticketsTitle: fields.text({ label: 'Tickets Card Title' }),
            ticketsBody: fields.text({ label: 'Tickets Card Description', multiline: true }),
            ticketsUrl: fields.url({ label: 'Tickets URL' }),
            ticketsLabel: fields.text({ label: 'Tickets Button Text' }),
            ticketsNote: fields.text({ label: 'Tickets Note', validation: { isRequired: false } }),
            squareTitle: fields.text({ label: 'Merch Card Title' }),
            squareBody: fields.text({ label: 'Merch Card Description', multiline: true }),
            squareUrl: fields.text({ label: 'Merch Store URL', description: 'Use /merch/ for internal store' }),
            squareLabel: fields.text({ label: 'Merch Button Text' }),
            squareNote: fields.text({ label: 'Merch Note', validation: { isRequired: false } }),
          },
        }),

        // — Instagram section —
        instagram: fields.object({
          label: 'Instagram',
          fields: {
            username: fields.text({ label: 'Username (without @)' }),
            profileUrl: fields.url({ label: 'Profile URL' }),
            previews: fields.array(
              fields.object({
                label: 'Preview Image',
                fields: {
                  image: fields.url({ label: 'Image URL' }),
                  alt: fields.text({ label: 'Alt Text', validation: { isRequired: false } }),
                },
              }),
              { label: 'Preview Images', itemLabel: (props) => props.fields.alt.value || 'Preview' }
            ),
          },
        }),

        // — Footer —
        footer: fields.object({
          label: 'Footer',
          fields: {
            organizationName: fields.text({ label: 'Organization Name' }),
            tagline: fields.text({ label: 'Tagline', validation: { isRequired: false } }),
            copyright: fields.text({ label: 'Copyright Text' }),
            quickLinksTitle: fields.text({ label: 'Quick Links Heading' }),
            connectTitle: fields.text({ label: 'Connect Heading' }),
            socialLinks: fields.array(
              fields.object({
                label: 'Social Link',
                fields: {
                  label: fields.text({ label: 'Platform Name' }),
                  url: fields.url({ label: 'URL' }),
                },
              }),
              { label: 'Social Links', itemLabel: (props) => props.fields.label.value || 'Link' }
            ),
          },
        }),

        // — SEO / meta —
        meta: fields.object({
          label: 'SEO & Meta Tags',
          fields: {
            siteName: fields.text({ label: 'Site Name' }),
            tagline: fields.text({ label: 'Tagline' }),
            description: fields.text({ label: 'Meta Description', multiline: true }),
            keywords: fields.text({ label: 'Meta Keywords' }),
            ogImage: fields.url({ label: 'OG Image URL', validation: { isRequired: false } }),
            ogUrl: fields.url({ label: 'Canonical URL' }),
          },
        }),

        // — Section titles —
        sections: fields.object({
          label: 'Section Titles',
          fields: {
            announcements: fields.object({
              label: 'Announcements',
              fields: { title: fields.text({ label: 'Section Title' }) },
            }),
            events: fields.object({
              label: 'Events Calendar',
              fields: {
                title: fields.text({ label: 'Section Title' }),
                emptyMessage: fields.text({ label: 'Empty State Message' }),
              },
            }),
            gallery: fields.object({
              label: 'Gallery',
              fields: { title: fields.text({ label: 'Section Title' }) },
            }),
            tickets: fields.object({
              label: 'Tickets & Merch',
              fields: { title: fields.text({ label: 'Section Title' }) },
            }),
            instagram: fields.object({
              label: 'Instagram',
              fields: {
                title: fields.text({ label: 'Section Title' }),
                subtitle: fields.text({ label: 'Subtitle', description: 'Use {handle} for username', multiline: true }),
              },
            }),
          },
        }),

        // — Checkout page copy —
        checkout: fields.object({
          label: 'Checkout Page Labels',
          fields: {
            pageTitle: fields.text({ label: 'Page Title (browser tab)' }),
            pageDescription: fields.text({ label: 'Page Description (SEO)', multiline: true }),
            title: fields.text({ label: 'Heading' }),
            shippingTitle: fields.text({ label: 'Shipping Section Title' }),
            paymentTitle: fields.text({ label: 'Payment Section Title' }),
            continueLabel: fields.text({ label: 'Continue Button' }),
            backLabel: fields.text({ label: 'Back Button' }),
            payNowLabel: fields.text({ label: 'Pay Button' }),
            processingLabel: fields.text({ label: 'Processing Text' }),
            emptyCartRedirect: fields.text({ label: 'Empty Cart Message' }),
          },
        }),

        // — Order success page copy —
        success: fields.object({
          label: 'Order Success Page',
          fields: {
            pageTitle: fields.text({ label: 'Page Title (browser tab)' }),
            title: fields.text({ label: 'Heading' }),
            message: fields.text({ label: 'Message', multiline: true }),
            note: fields.text({ label: 'Note', multiline: true }),
            backToMerchLabel: fields.text({ label: 'Back to Merch Button' }),
            backToSiteLabel: fields.text({ label: 'Back to Site Button' }),
          },
        }),
      },
    }),

    // -----------------------------------------------------------------------
    // 2. ANNOUNCEMENTS  →  content/updates.json
    // -----------------------------------------------------------------------
    updates: singleton({
      label: 'Latest Updates',
      path: 'content/updates',
      format: { data: 'json' },
      schema: {
        updates: fields.array(
          fields.object({
            label: 'Announcement Card',
            fields: {
              title: fields.text({ label: 'Title' }),
              date: fields.date({ label: 'Date' }),
              pinned: fields.checkbox({ label: 'Pinned to Top', defaultValue: false }),
              body: fields.text({ label: 'Description', multiline: true }),
              image: fields.url({ label: 'Image URL', validation: { isRequired: false } }),
              imageUpload: img('Or Upload Image'),
              alt: fields.text({ label: 'Image Alt Text', validation: { isRequired: false } }),
              ctaLabel: fields.text({ label: 'Button Text', validation: { isRequired: false } }),
              ctaUrl: fields.text({ label: 'Button URL', validation: { isRequired: false } }),
              ctaStyle: fields.select({
                label: 'Button Style',
                options: [
                  { label: 'Primary', value: 'primary' },
                  { label: 'Secondary', value: 'secondary' },
                ],
                defaultValue: 'primary',
              }),
            },
          }),
          {
            label: 'Announcement Cards',
            itemLabel: (props) =>
              `${props.fields.title.value || 'Untitled'} (${props.fields.date.value || 'no date'})`,
          }
        ),
      },
    }),

    // -----------------------------------------------------------------------
    // 3. EVENTS CALENDAR  →  data/events.json
    // -----------------------------------------------------------------------
    events: singleton({
      label: 'Events Calendar',
      path: 'data/events',
      format: { data: 'json' },
      schema: {
        events: fields.array(
          fields.object({
            label: 'Event',
            fields: {
              id: fields.text({ label: 'Event ID', description: "Unique slug e.g. 'still-got-it-vol-4'" }),
              title: fields.text({ label: 'Event Name' }),
              date: fields.date({ label: 'Date' }),
              time: fields.text({ label: 'Time', description: "e.g. '6–10 PM'", validation: { isRequired: false } }),
              venue: fields.text({ label: 'Venue Name', validation: { isRequired: false } }),
              location: fields.text({ label: 'Location / City', validation: { isRequired: false } }),
              description: fields.text({ label: 'Description', multiline: true, validation: { isRequired: false } }),
              image: fields.text({ label: 'Event Image Path', validation: { isRequired: false } }),
              ticketUrl: fields.url({ label: 'Ticket URL', validation: { isRequired: false } }),
              ctaLabel: fields.text({ label: 'Ticket Button Text', validation: { isRequired: false } }),
            },
          }),
          {
            label: 'Events',
            itemLabel: (props) =>
              `${props.fields.title.value || 'Untitled'} — ${props.fields.date.value || 'no date'}`,
          }
        ),
      },
    }),

    // -----------------------------------------------------------------------
    // 4. GALLERY  →  content/gallery.json
    // -----------------------------------------------------------------------
    gallery: singleton({
      label: 'Event Gallery',
      path: 'content/gallery',
      format: { data: 'json' },
      schema: {
        images: fields.array(
          fields.object({
            label: 'Gallery Photo',
            fields: {
              src: fields.text({ label: 'Full Image Path', validation: { isRequired: false } }),
              thumb: fields.text({ label: 'Thumbnail Path', validation: { isRequired: false } }),
              alt: fields.text({ label: 'Caption / Alt Text' }),
              featured: fields.checkbox({ label: 'Featured (show first)', defaultValue: false }),
              tags: fields.array(fields.text({ label: 'Tag' }), { label: 'Tags', itemLabel: (props) => props.value }),
              location: fields.text({ label: 'Location', validation: { isRequired: false } }),
              date: fields.date({ label: 'Photo Date', validation: { isRequired: false } }),
            },
          }),
          { label: 'Photos', itemLabel: (props) => props.fields.alt.value || 'Photo' }
        ),
      },
    }),

    // -----------------------------------------------------------------------
    // 5. MERCH CATALOG  →  content/merch.json
    // -----------------------------------------------------------------------
    merch: singleton({
      label: 'Merch Catalog',
      path: 'content/merch',
      format: { data: 'json' },
      schema: {
        currency: fields.text({ label: 'Currency Code' }),
        products: fields.array(
          fields.object({
            label: 'Product',
            fields: {
              id: fields.text({ label: 'Product ID', description: "Unique slug e.g. 'tee-classic'" }),
              name: fields.text({ label: 'Product Name' }),
              description: fields.text({ label: 'Description', multiline: true }),
              priceCents: fields.integer({ label: 'Price (cents)', description: 'e.g. 2800 = $28.00' }),
              image: img('Product Image'),
              variants: fields.array(
                fields.object({
                  label: 'Variant',
                  fields: {
                    id: fields.text({ label: 'Variant ID' }),
                    label: fields.text({ label: 'Label', description: "e.g. 'Medium'" }),
                    printfulVariantId: fields.integer({ label: 'Printful Variant ID', validation: { isRequired: false } }),
                    priceCents: fields.integer({ label: 'Price Override (cents)', validation: { isRequired: false } }),
                  },
                }),
                { label: 'Variants', itemLabel: (props) => props.fields.label.value || 'Variant' }
              ),
              fulfillment: fields.object({
                label: 'Fulfillment',
                fields: {
                  type: fields.select({
                    label: 'Type',
                    options: [
                      { label: 'Printful (auto-fulfilled)', value: 'printful' },
                      { label: 'Manual (you ship it)', value: 'manual' },
                    ],
                    defaultValue: 'printful',
                  }),
                  printfulVariantId: fields.integer({ label: 'Printful Variant ID', validation: { isRequired: false } }),
                },
              }),
            },
          }),
          { label: 'Products', itemLabel: (props) => props.fields.name.value || 'Product' }
        ),
      },
    }),

    // -----------------------------------------------------------------------
    // 6. STANDALONE PAGES
    // -----------------------------------------------------------------------

    aboutPage: singleton({
      label: 'About Page',
      path: 'content/pages/about',
      format: { data: 'json' },
      schema: {
        metaTitle: fields.text({ label: 'Page Title (SEO)' }),
        metaDescription: fields.text({ label: 'Meta Description', multiline: true }),
        heroTitle: fields.text({ label: 'Hero Title' }),
        heroSubtitle: fields.text({ label: 'Hero Subtitle', multiline: true, validation: { isRequired: false } }),
        sections: fields.array(
          fields.object({
            label: 'Content Section',
            fields: {
              title: fields.text({ label: 'Section Title' }),
              body: fields.array(
                fields.text({ label: 'Paragraph', multiline: true }),
                { label: 'Paragraphs', itemLabel: (props) => props.value?.slice(0, 40) || 'Paragraph' }
              ),
              contacts: fields.array(
                fields.object({
                  label: 'Contact Item',
                  fields: {
                    label: fields.text({ label: 'Label' }),
                    value: fields.text({ label: 'Value' }),
                    url: fields.url({ label: 'Link URL', validation: { isRequired: false } }),
                  },
                }),
                { label: 'Contact Info', itemLabel: (props) => props.fields.label.value || 'Contact' }
              ),
            },
          }),
          { label: 'Content Sections', itemLabel: (props) => props.fields.title.value || 'Section' }
        ),
      },
    }),

    contactPage: singleton({
      label: 'Contact Page',
      path: 'content/pages/contact',
      format: { data: 'json' },
      schema: {
        metaTitle: fields.text({ label: 'Page Title (SEO)' }),
        metaDescription: fields.text({ label: 'Meta Description', multiline: true }),
        heroTitle: fields.text({ label: 'Hero Title' }),
        heroSubtitle: fields.text({ label: 'Hero Subtitle', multiline: true, validation: { isRequired: false } }),
        sections: fields.array(
          fields.object({
            label: 'Content Section',
            fields: {
              title: fields.text({ label: 'Section Title' }),
              body: fields.array(
                fields.text({ label: 'Paragraph', multiline: true }),
                { label: 'Paragraphs', itemLabel: (props) => props.value?.slice(0, 40) || 'Paragraph' }
              ),
              contacts: fields.array(
                fields.object({
                  label: 'Contact Item',
                  fields: {
                    label: fields.text({ label: 'Label' }),
                    value: fields.text({ label: 'Value' }),
                    url: fields.url({ label: 'Link URL', validation: { isRequired: false } }),
                  },
                }),
                { label: 'Contact Info', itemLabel: (props) => props.fields.label.value || 'Contact' }
              ),
            },
          }),
          { label: 'Content Sections', itemLabel: (props) => props.fields.title.value || 'Section' }
        ),
      },
    }),

    eventsPage: singleton({
      label: 'Events Page Settings',
      path: 'content/pages/events',
      format: { data: 'json' },
      schema: {
        metaTitle: fields.text({ label: 'Page Title (SEO)' }),
        metaDescription: fields.text({ label: 'Meta Description', multiline: true }),
        pageTitle: fields.text({ label: 'Page Heading' }),
        pageSubtitle: fields.text({ label: 'Page Subtitle', multiline: true, validation: { isRequired: false } }),
        emptyMessage: fields.text({ label: 'Empty State Message' }),
      },
    }),

    merchPage: singleton({
      label: 'Merch Page Settings',
      path: 'content/pages/merch',
      format: { data: 'json' },
      schema: {
        metaTitle: fields.text({ label: 'Page Title (SEO)' }),
        metaDescription: fields.text({ label: 'Meta Description', multiline: true }),
        heroTitle: fields.text({ label: 'Hero Title' }),
        heroSubtitle: fields.text({ label: 'Hero Subtitle', multiline: true, validation: { isRequired: false } }),
        catalogLabel: fields.text({ label: 'Catalog Section Label' }),
        cartTitle: fields.text({ label: 'Cart Title' }),
        subtotalLabel: fields.text({ label: 'Subtotal Label' }),
        shippingNote: fields.text({ label: 'Shipping Note', multiline: true }),
        checkoutLabel: fields.text({ label: 'Checkout Button Text' }),
        clearCartLabel: fields.text({ label: 'Clear Cart Text' }),
        emptyCartMessage: fields.text({ label: 'Empty Cart Message' }),
      },
    }),

    legalPage: singleton({
      label: 'Legal Page',
      path: 'content/pages/legal',
      format: { data: 'json' },
      schema: {
        metaTitle: fields.text({ label: 'Page Title (SEO)' }),
        metaDescription: fields.text({ label: 'Meta Description', multiline: true }),
        heroTitle: fields.text({ label: 'Hero Title' }),
        heroSubtitle: fields.text({ label: 'Hero Subtitle', multiline: true, validation: { isRequired: false } }),
        sections: fields.array(
          fields.object({
            label: 'Content Section',
            fields: {
              title: fields.text({ label: 'Section Title' }),
              body: fields.array(
                fields.text({ label: 'Paragraph', multiline: true }),
                { label: 'Paragraphs', itemLabel: (props) => props.value?.slice(0, 40) || 'Paragraph' }
              ),
            },
          }),
          { label: 'Content Sections', itemLabel: (props) => props.fields.title.value || 'Section' }
        ),
      },
    }),
  },
});
