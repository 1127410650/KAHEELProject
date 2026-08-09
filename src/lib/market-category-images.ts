import artsImage from "@/assets/categories/arts.webp";
import carsImage from "@/assets/categories/cars.webp";
import devicesImage from "@/assets/categories/devices.webp";
import eventsImage from "@/assets/categories/events.webp";
import fashionImage from "@/assets/categories/fashion.webp";
import furnitureImage from "@/assets/categories/furniture.webp";
import gardensImage from "@/assets/categories/gardens.webp";
import jobsImage from "@/assets/categories/jobs.webp";
import lostfoundImage from "@/assets/categories/lostfound.webp";
import programmingImage from "@/assets/categories/programming.webp";
import projectsImage from "@/assets/categories/projects.webp";
import realestateImage from "@/assets/categories/realestate.webp";
import restaurantsImage from "@/assets/categories/restaurants.webp";
import schoolsImage from "@/assets/categories/schools.webp";
import servicesImage from "@/assets/categories/services.webp";
import trainingImage from "@/assets/categories/training.webp";
import travelImage from "@/assets/categories/travel.webp";

/**
 * One shared, square photo per primary field. Every tile in the marketplace
 * reads from this map so the photo set stays a single consistent series.
 * Intrinsic size is fixed at 256x256 — always render with explicit width and
 * height so a loading photo can never shift the layout.
 */
export const CATEGORY_IMAGE_SIZE = 256;

export const CATEGORY_IMAGES: Record<string, string> = {
  arts: artsImage,
  cars: carsImage,
  devices: devicesImage,
  events: eventsImage,
  fashion: fashionImage,
  furniture: furnitureImage,
  gardens: gardensImage,
  jobs: jobsImage,
  lostfound: lostfoundImage,
  programming: programmingImage,
  projects: projectsImage,
  realestate: realestateImage,
  restaurants: restaurantsImage,
  schools: schoolsImage,
  services: servicesImage,
  training: trainingImage,
  travel: travelImage,
};

export function categoryImage(id: string): string | undefined {
  return CATEGORY_IMAGES[id];
}
