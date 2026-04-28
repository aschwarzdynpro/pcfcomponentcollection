# Dataverse CRUD PCF Component

A modern, React-based Power Apps Component Framework (PCF) component that provides full CRUD (Create, Read, Update, Delete) operations for Dataverse entities with a beautiful, responsive user interface.

![Component Demo](https://github.com/user-attachments/assets/0dfb97b1-8b2e-46f9-aa34-cf2fff62b642)

*Search functionality in action:*
![Search Demo](https://github.com/user-attachments/assets/bb852bd5-0065-43ca-b494-bd0c23173dd5)

## ✨ Features

### 🎯 Core Functionality
- **Full CRUD Operations**: Create, Read, Update, and Delete records
- **Real-time Search**: Instant filtering across all visible fields
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Beautiful UI**: Modern card-based layout with smooth animations
- **Type Safety**: Built with TypeScript for robust development

### 🎨 Visual Features
- **Card-based Layout**: Clean, modern presentation of records
- **Interactive Elements**: Hover effects and smooth transitions
- **Icon-based Field Types**: Visual indicators for different data types
- **Professional Styling**: Gradient backgrounds and shadow effects
- **Intuitive Controls**: Clear action buttons with visual feedback

### 🔧 Technical Features
- **React-based**: Modern component architecture
- **WebAPI Integration**: Native Dataverse operations
- **Form Validation**: Client-side validation with error handling
- **Pagination Support**: Efficient handling of large datasets
- **Configurable Permissions**: Control create, update, and delete access

## 🚀 Component Structure

```
DataverseCrudComponent/
├── components/
│   ├── DataverseCrudApp.tsx          # Main application component
│   ├── DataverseRecord.tsx           # Individual record card component
│   ├── CreateRecordForm.tsx          # Create new record form
│   └── EditRecordForm.tsx            # Edit existing record form
├── css/
│   └── DataverseCrudComponent.css    # Complete styling
├── strings/
│   └── DataverseCrudComponent.1033.resx  # Localization resources
├── generated/
│   └── ManifestTypes.d.ts           # Auto-generated type definitions
├── ControlManifest.Input.xml         # PCF manifest configuration
├── index.ts                          # Main control implementation
├── package.json                      # Dependencies and scripts
└── tsconfig.json                     # TypeScript configuration
```

## 📋 Configuration Properties

The component supports the following configurable properties:

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `sampleDataSet` | DataSet | The dataset containing records to display | Required |
| `allowCreate` | TwoOptions | Enable/disable record creation | `true` |
| `allowUpdate` | TwoOptions | Enable/disable record editing | `true` |
| `allowDelete` | TwoOptions | Enable/disable record deletion | `true` |

## 🎮 User Interface Features

### Main View
- **Header Section**: Component title with description
- **Search Bar**: Real-time filtering across all fields
- **Create Button**: Add new records (when enabled)
- **Records Grid**: Responsive card layout for displaying records

### Record Cards
- **Unique ID Display**: Shortened record identifier
- **Field Icons**: Visual indicators for different data types:
  - 📝 Text fields
  - 📧 Email addresses
  - 📞 Phone numbers
  - 🏢 Company/Organization
  - 📅 Dates
  - ☑️ Boolean values
  - 💰 Currency
  - 🔢 Numbers
- **Action Buttons**: Edit and delete controls

### Forms
- **Dynamic Field Generation**: Automatically adapts to entity schema
- **Data Type Support**:
  - Single line text
  - Multi-line text
  - Numbers (whole and decimal)
  - Currency
  - Dates and date-time
  - Boolean (Yes/No)
  - Email
  - Phone
  - URL
- **Validation**: Required field validation with visual feedback
- **Change Tracking**: Visual indicators for modified fields

## 🛠️ Development

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn
- Power Platform CLI tools

### Build Commands
```bash
# Install dependencies
npm install

# Build the component
npm run build

# Start development harness
npm start

# Clean build artifacts
npm run clean

# Rebuild everything
npm run rebuild
```

## 🎯 Data Operations

### Create Records
- Dynamic form generation based on entity schema
- Field validation and error handling
- Success/error feedback

### Read Records
- Automatic data loading from DataSet
- Real-time search and filtering
- Pagination support for large datasets

### Update Records
- Change tracking with visual indicators
- Optimistic updates
- Rollback on errors

### Delete Records
- Confirmation dialogs
- Soft delete support
- Immediate UI updates

## 📱 Responsive Design

The component is fully responsive and adapts to different screen sizes:

- **Desktop**: Multi-column card grid
- **Tablet**: Adjusted card sizing and spacing
- **Mobile**: Single-column layout with optimized touch targets

## 🔒 Security & Permissions

- Respects Dataverse security roles
- Configurable CRUD permissions
- Input validation and sanitization
- Secure WebAPI operations

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 📊 Performance Features

- **Lazy Loading**: Efficient data loading patterns
- **Virtual Scrolling**: Handle large datasets
- **Optimized Rendering**: React best practices
- **Minimal Bundle Size**: Tree-shaken dependencies

## 🔧 Integration

### Power Apps Integration
1. Build the component using `npm run build`
2. Import the solution into your environment
3. Add to forms, views, or dashboards
4. Configure dataset and permissions

### Dataverse Setup
- Ensure entity has appropriate fields
- Configure security roles for CRUD operations
- Set up any required lookups or relationships

## 📈 Future Enhancements

- **Advanced Filtering**: Date ranges, multi-select filters
- **Bulk Operations**: Select multiple records for batch actions
- **Export Functionality**: CSV/Excel export capabilities
- **Audit Trail**: Track changes and modifications
- **Custom Field Renderers**: Specialized field type displays
- **Offline Support**: Work with cached data

## 🐛 Troubleshooting

### Common Issues

1. **Build Errors**: Ensure all dependencies are installed with `npm install`
2. **Type Errors**: Verify TypeScript configuration matches PCF requirements
3. **Display Issues**: Check CSS loading and responsive breakpoints
4. **Data Loading**: Verify DataSet configuration and entity permissions

### Debug Mode
Enable debugging by setting the component to development mode and checking browser console for detailed error messages.

## 📝 License

This project is licensed under the MIT License.

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

*Part of the Power Platform PCF Component Collection.*
