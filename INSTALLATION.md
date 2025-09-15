# Dataverse CRUD PCF Component - Installation Guide

## 📦 Installation Steps

### Prerequisites
- Power Platform environment with Dataverse
- System Administrator or System Customizer security role
- Power Platform CLI (optional, for development)

### Option 1: Import Solution Package (Recommended)

1. **Build the Solution**
   ```bash
   cd DataverseCrudComponent
   npm install
   npm run build
   ```

2. **Create Solution Package**
   - Use Power Platform CLI to create a solution
   - Add the PCF component to the solution
   - Export as managed solution

3. **Import to Target Environment**
   - Open Power Platform admin center
   - Navigate to your target environment
   - Import the solution package

### Option 2: Manual Deployment

1. **Build the Component**
   ```bash
   cd DataverseCrudComponent
   npm install
   npm run build
   ```

2. **Upload to Environment**
   - Open Power Apps maker portal
   - Go to Solutions
   - Create new solution or select existing
   - Add existing > More > Developer > PCF control
   - Upload the built component files

### Option 3: Development Setup

1. **Clone Repository**
   ```bash
   git clone [repository-url]
   cd pcfcomponentcollection/DataverseCrudComponent
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Adding to Forms
1. Open the target table in the form designer
2. Add a new section or use existing
3. Insert > Component
4. Select "Dataverse CRUD Component"
5. Configure the dataset to bind to your table
6. Set permissions (Create, Update, Delete) as needed

### Adding to Views
1. Open the model-driven app
2. Edit the target view
3. Add custom control
4. Select "Dataverse CRUD Component"
5. Configure dataset binding

### Adding to Dashboards
1. Open dashboard designer
2. Add component tile
3. Select "Dataverse CRUD Component"
4. Configure data source and permissions

## ⚙️ Component Properties

Configure these properties when adding the component:

| Property | Description | Required | Default |
|----------|-------------|----------|---------|
| Sample Dataset | The dataset containing records to display and manage | Yes | None |
| Allow Create | Enable users to create new records | No | True |
| Allow Update | Enable users to edit existing records | No | True |
| Allow Delete | Enable users to delete records | No | True |

## 🔐 Security Configuration

### Required Permissions
Ensure users have appropriate security roles with:

- **Read** access to the target table
- **Create** access (if creation is enabled)
- **Write** access (if editing is enabled) 
- **Delete** access (if deletion is enabled)

### Field-Level Security
- Component respects field-level security
- Hidden fields won't appear in forms
- Read-only fields will be disabled in edit mode

## 🎯 Supported Field Types

The component automatically handles these Dataverse field types:

- **Single Line of Text**
- **Multiple Lines of Text**
- **Whole Number**
- **Decimal Number**
- **Currency**
- **Date Only**
- **Date and Time**
- **Yes/No (Boolean)**
- **Email**
- **Phone**
- **URL**

## 📱 Mobile Support

The component is fully responsive and supports:
- Touch interactions
- Mobile-optimized layouts
- Swipe gestures (where applicable)
- Responsive breakpoints

## 🌐 Browser Compatibility

Tested and supported on:
- Microsoft Edge (latest)
- Google Chrome (latest)
- Mozilla Firefox (latest)
- Safari (latest)

## 🔍 Troubleshooting

### Common Issues

1. **Component Not Loading**
   - Verify the solution is imported correctly
   - Check browser console for JavaScript errors
   - Ensure proper security permissions

2. **Data Not Displaying**
   - Verify dataset is configured correctly
   - Check table permissions
   - Ensure records exist in the target table

3. **CRUD Operations Failing**
   - Verify user has appropriate security roles
   - Check for required fields validation
   - Review business rules and workflows

4. **Styling Issues**
   - Clear browser cache
   - Check for conflicting CSS
   - Verify component version compatibility

### Debug Mode

Enable debug mode for detailed logging:
1. Add `?debug=true` to the URL
2. Open browser developer tools
3. Check console for detailed error messages

## 📞 Support

For issues and questions:
1. Check the troubleshooting guide above
2. Review the component documentation
3. Open an issue in the repository
4. Contact your system administrator

## 🔄 Updates

To update the component:
1. Build the latest version
2. Create new solution package
3. Import as upgrade to existing environment
4. Test thoroughly before deploying to production

---

*For additional support, please refer to the main README.md file*