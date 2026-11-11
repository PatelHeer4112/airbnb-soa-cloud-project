const mongoose = require('mongoose');

const PROPERTY_TYPES = ['Apartment', 'House', 'Villa', 'Cabin', 'Cottage', 'Studio', 'Loft', 'Guesthouse'];

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'title is required'], trim: true, maxlength: 120 },
    description: { type: String, required: [true, 'description is required'], trim: true, maxlength: 2000 },
    propertyType: {
      type: String,
      required: [true, 'propertyType is required'],
      enum: { values: PROPERTY_TYPES, message: 'propertyType must be one of: ' + PROPERTY_TYPES.join(', ') },
    },
    // Neighbourhood or area within the city, e.g. "Shoreditch".
    location: { type: String, required: [true, 'location is required'], trim: true, maxlength: 120 },
    city: { type: String, required: [true, 'city is required'], trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    country: { type: String, required: [true, 'country is required'], trim: true, maxlength: 80 },
    pricePerNight: { type: Number, required: [true, 'pricePerNight is required'], min: [1, 'pricePerNight must be at least 1'] },
    maxGuests: {
      type: Number,
      required: [true, 'maxGuests is required'],
      min: [1, 'maxGuests must be at least 1'],
      max: [20, 'maxGuests cannot exceed 20'],
      validate: { validator: Number.isInteger, message: 'maxGuests must be a whole number' },
    },
    bedrooms: { type: Number, required: [true, 'bedrooms is required'], min: 0 },
    bathrooms: { type: Number, required: [true, 'bathrooms is required'], min: 0 },
    amenities: { type: [String], default: [] },
    imageUrls: { type: [String], default: [] },
    rating: { type: Number, min: 0, max: 5, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

// Indexes that match the search service's most common filters.
listingSchema.index({ city: 1, pricePerNight: 1 });
listingSchema.index({ propertyType: 1, pricePerNight: 1 });
listingSchema.index({ maxGuests: 1 });
listingSchema.index({ createdAt: -1 });

const Listing = mongoose.model('Listing', listingSchema);

module.exports = Listing;
module.exports.PROPERTY_TYPES = PROPERTY_TYPES;
