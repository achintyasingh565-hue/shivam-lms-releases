  /* ===================== Cloud sync configuration =====================
     These two values come from your Supabase project
     (Project Settings -> API Keys). The publishable key is SAFE to ship in
     the app — it can do nothing until a staff member logs in, and the database
     is locked by Row Level Security. The SECRET key is never put here.

     To turn cloud sync OFF (run fully local again), set enabled:false. */
  window.CLOUD = {
    enabled: true,
    url: 'https://djbprwbrnioxkakpnilc.supabase.co',
    key: 'sb_publishable_bCWjrAoYGzhKI8a2tMwKRw_VqT_dr-c',
    pollMs: 7000,        // how often each device checks for changes from the other
    encryptIds: false    // optional: encrypt Aadhaar/PAN before upload (see CLOUD-SETUP.md)
  };
