
/**
 * Facebook Pixel / Meta Conversions API Tracking Utility
 */

declare global {
  interface Window {
    fbq: any;
  }
}

export const fbTrack = (eventName: string, data?: object) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, data);
    console.log(`[FB Pixel] Tracked: ${eventName}`, data);
  }
};

export const fbTrackCustom = (eventName: string, data?: object) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', eventName, data);
    console.log(`[FB Pixel] Tracked Custom: ${eventName}`, data);
  }
};

// Common events helpers
export const trackViewContent = (id: string, name: string, price: number) => {
  fbTrack('ViewContent', {
    content_ids: [id],
    content_name: name,
    value: price,
    currency: 'VND',
    content_type: 'product'
  });
};

export const trackAddToCart = (id: string, name: string, price: number, quantity: number = 1) => {
  fbTrack('AddToCart', {
    content_ids: [id],
    content_name: name,
    value: price * quantity,
    currency: 'VND',
    content_type: 'product'
  });
};

export const trackInitiateCheckout = (value: number, numItems: number) => {
  fbTrack('InitiateCheckout', {
    value: value,
    currency: 'VND',
    num_items: numItems
  });
};

export const trackPurchase = (orderId: string, value: number, items: any[]) => {
  fbTrack('Purchase', {
    content_ids: items.map(i => i.templateId || i.id),
    content_type: 'product',
    value: value,
    currency: 'VND',
    order_id: orderId
  });
};
