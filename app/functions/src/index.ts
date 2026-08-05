// No billing/payment code here. Premium purchase will route through an
// external Stripe Payment Link (see plan discussed for /premium) with a
// Supabase Edge Function handling the webhook — nothing for Firebase
// Functions to do, and it can't deploy on this project's Spark plan anyway.
