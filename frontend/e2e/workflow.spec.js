import { test, expect } from '@playwright/test';
const id = 'a'.repeat(24), bookingId = 'b'.repeat(24);
const listing = { _id:id, title:'Quiet garden cottage', city:'London', country:'United Kingdom', location:'Greenwich', propertyType:'Cottage', pricePerNight:120, maxGuests:4, bedrooms:2, bathrooms:1, rating:4.8, amenities:['Wi-Fi','Garden'], imageUrls:[], description:'A peaceful place to reconnect.' };
test.beforeEach(async ({page}) => {
  let booked = false, status = 'Pending';
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()); let data;
    if (url.pathname === '/api/search') data = [listing];
    else if (url.pathname === `/api/listings/${id}`) data = listing;
    else if (url.pathname.endsWith('/bookings') && request.method() === 'GET') data = { bookedRanges:[] };
    else if (url.pathname === '/api/availability') data = {available: !booked, numberOfNights:2};
    else if (request.method() === 'POST') {
      const body = request.postDataJSON(); expect(body.numberOfGuests).toBe(2); expect(body).not.toHaveProperty('totalPrice');
      if (booked) return route.fulfill({status:409,json:{success:false,error:{code:'BOOKING_CONFLICT',message:'These dates are already reserved.'}}});
      booked = true; data = {_id:bookingId};
    } else { if(request.method() === 'PATCH') {status='Cancelled';booked=false;} data = {_id:bookingId,listing,guestName:'Test Guest',guestEmail:'test@example.com',numberOfGuests:2,numberOfNights:2,totalPrice:240,bookingStatus:status,checkInDate:'2099-01-01',checkOutDate:'2099-01-03'}; }
    await route.fulfill({json:{success:true,data,meta:{page:Number(url.searchParams.get('page')||1),total:1,totalPages:1}}});
  });
});
test('search, inspect, check availability, book, reload, and cancel', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Where to?').fill('London');
  await page.getByLabel('Check-in', {exact:true}).fill('2099-01-01');
  await page.getByLabel('Check-out', {exact:true}).fill('2099-01-03');
  await page.getByLabel('Who’s coming?').fill('2');
  await page.getByRole('button', {name:'Search stays'}).click();
  await expect(page).toHaveURL(/location=London/);
  await page.getByRole('link').filter({has:page.getByRole('heading',{name:listing.title})}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText(listing.title);
  await expect(page.getByLabel('Check-in',{exact:true})).toHaveValue('2099-01-01');
  await page.getByRole('button',{name:'Check availability'}).click();
  await expect(page.getByText('These dates are available.')).toBeVisible();
  await page.getByLabel('Full name').fill('Test Guest'); await page.getByLabel('Email address').fill('test@example.com');
  await page.getByRole('button',{name:'Request to book'}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('A good stay starts here.');
  await expect(page.getByLabel('Booking reference',{exact:true})).toHaveValue(bookingId);
  await page.reload(); await expect(page.getByText('Pending',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancel this booking'}).click();
  await page.getByRole('button',{name:'Yes, cancel booking'}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Until next time.');
});
test('empty results and unavailable service provide recovery', async ({page}) => {
  await page.route('**/api/search?**', route => route.fulfill({json:{success:true,data:[],meta:{total:0,totalPages:0,page:1}}}));
  await page.goto('/'); await expect(page.getByText('No stays found. A fresh start?')).toBeVisible();
  await page.route('**/api/search?**', route => route.abort());
  await page.getByRole('button',{name:'Clear filters'}).click();
  await expect(page.getByRole('alert')).toContainText('could not reach');
  await expect(page.getByRole('button',{name:'Try again'})).toBeVisible();
});
test('mobile layout fits viewport and backend errors are visible', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await expect(page.getByRole('heading',{name:'Quiet garden cottage'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});
  await page.goto(`/#/listing/${id}`);
  await page.getByLabel('Check-in',{exact:true}).fill('2099-01-01'); await page.getByLabel('Check-out',{exact:true}).fill('2099-02-10');
  await page.getByRole('button',{name:'Check availability'}).click(); await expect(page.getByRole('alert')).toContainText('30 nights');
});
test('booking conflict keeps guest input and explains the failure', async ({page}) => {
  await page.route('**/api/bookings', route => route.fulfill({status:409,json:{success:false,error:{code:'BOOKING_CONFLICT',message:'The listing is not available for the selected dates'}}}));
  await page.goto(`/#/listing/${id}`);
  await page.getByLabel('Check-in',{exact:true}).fill('2099-01-01'); await page.getByLabel('Check-out',{exact:true}).fill('2099-01-03');
  await page.getByLabel('Guests',{exact:true}).fill('2');
  await page.getByLabel('Full name').fill('Test Guest'); await page.getByLabel('Email address').fill('test@example.com');
  await page.getByRole('button',{name:'Request to book'}).click();
  await expect(page.getByRole('alert')).toContainText('not available');
  await expect(page.getByLabel('Full name')).toHaveValue('Test Guest');
  await expect(page.getByRole('button',{name:'Request to book'})).toBeEnabled();
});

test('TravelTrove navigation and destination cards work on mobile', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Open navigation'}).click();
  await expect(page.getByRole('button',{name:'Close navigation'})).toHaveAttribute('aria-expanded','true');
  await page.getByRole('link',{name:'Popular Getaways',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open navigation'})).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:/France Paris/}).click();
  await expect(page.getByLabel('Where to?')).toHaveValue('Paris');
  await expect(page).toHaveURL(/location=Paris/);
  await page.goto(`/#/listing/${id}`);
  await page.getByRole('button',{name:'Open navigation'}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Open navigation'})).toHaveAttribute('aria-expanded','false');
});

test('home, listing and booking layouts fit narrow, tablet and desktop screens', async ({page}) => {
  for (const width of [320,768,1440]) {
    await page.setViewportSize({width,height:900});
    for (const path of ['/',`/#/listing/${id}`,`/#/booking/${bookingId}`]) {
      await page.goto(path);
      await expect(page.getByRole('heading',{level:1})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`${path} at ${width}px`).toBe(true);
      if (path === '/') await page.screenshot({path:`test-results/traveltrove-home-${width}.png`,fullPage:true});
    }
  }
});
