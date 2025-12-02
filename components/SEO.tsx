import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description?: string;
    image?: string;
    url?: string;
    type?: 'website' | 'product' | 'article';
    price?: number;
    currency?: string;
    availability?: string;
}

export const SEO: React.FC<SEOProps> = ({ 
    title, 
    description = "The Luvin - Thương hiệu quà tặng LEGO thiết kế cá nhân hóa. Lưu giữ kỷ niệm độc bản với khung tranh LEGO.",
    image = "https://res.cloudinary.com/dbdqd93km/image/upload/v1763705477/ce3r3dzdpp2gn5nv3jdx.png",
    url = window.location.href,
    type = 'website',
    price,
    currency = 'VND',
    availability = 'InStock'
}) => {
    const siteTitle = `${title} | The Luvin`;

    // Basic JSON-LD for Organization
    const organizationSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "The Luvin",
        "url": "https://theluvin.com",
        "logo": "https://res.cloudinary.com/dbdqd93km/image/upload/v1763705477/ce3r3dzdpp2gn5nv3jdx.png",
        "sameAs": [
            "https://www.facebook.com/theluvin",
            "https://www.instagram.com/the_luvin/",
            "https://www.tiktok.com/@the_luvin"
        ]
    };

    // Dynamic JSON-LD for Product (if applicable)
    let schemaJson = JSON.stringify(organizationSchema);

    if (type === 'product' && price) {
        const productSchema = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": title,
            "image": [image],
            "description": description,
            "brand": {
                "@type": "Brand",
                "name": "The Luvin"
            },
            "offers": {
                "@type": "Offer",
                "url": url,
                "priceCurrency": currency,
                "price": price,
                "itemCondition": "https://schema.org/NewCondition",
                "availability": `https://schema.org/${availability}`
            }
        };
        schemaJson = JSON.stringify(productSchema);
    }

    return (
        <Helmet>
            {/* Standard Metadata */}
            <title>{siteTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={url} />

            {/* Open Graph / Facebook / Zalo */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={siteTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:url" content={url} />
            <meta property="og:site_name" content="The Luvin" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={siteTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {/* Structured Data */}
            <script type="application/ld+json">
                {schemaJson}
            </script>
        </Helmet>
    );
};
