// Prints the app's bundled event list as JSON, for seeding the server list (PUT /internal/app/events).
import { EVENTS } from '../src/v2/data/events';
process.stdout.write(JSON.stringify({ events: EVENTS }, null, 2));
