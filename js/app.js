$(document).ready(function () {

    // Initialize Quill editor
    const quill = new Quill('#prodSpecsEditor', {
        theme: 'snow',
        placeholder: 'Enter product specifications...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link']
            ]
        }
    });

    const categoriesDiv = $('#categories');
    const searchInput = $('#searchInput');
    let data = {};

    // -------------------- Utility Functions --------------------
    const saveToFirebase = () => firebaseOps.writeData("products", data);

    const saveLocal = () => {
        localStorage.setItem('adminData', JSON.stringify(data));
        saveToFirebase(); // Auto-sync
    };

    const loadLocal = () => {
        const stored = localStorage.getItem('adminData');
        if (stored) {
            data = JSON.parse(stored);
            return true;
        }
        return false;
    };

    const resetQuill = () => quill.setContents([]);

    // -------------------- Dark Mode --------------------
    const themeToggle = $('#themeToggle');
    const body = $('body');

    if (localStorage.getItem('theme') === 'dark') {
        body.addClass('dark-mode').removeClass('bg-light');
        themeToggle.text('Light Mode');
    }

    themeToggle.click(() => {
        body.toggleClass('dark-mode');
        const isDark = body.hasClass('dark-mode');

        if (isDark) {
            body.removeClass('bg-light');
            themeToggle.text('Light Mode');
            localStorage.setItem('theme', 'dark');
        } else {
            body.addClass('bg-light');
            themeToggle.text('Dark Mode');
            localStorage.setItem('theme', 'light');
        }
    });

    // -------------------- Rendering --------------------
    function render() {
        categoriesDiv.empty();
        const searchTerm = searchInput.val().toLowerCase();

        for (let category in data) {
            // Filter products
            const products = data[category].filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                (p.coupon && p.coupon.toLowerCase().includes(searchTerm))
            );

            if (products.length === 0 && searchTerm) continue; // Skip empty categories during search

            const catCard = $('<div>').addClass('card mb-4');
            const catBody = $('<div>').addClass('card-body');

            // Header
            const header = $('<div>').addClass('d-flex justify-content-between align-items-center mb-3');
            header.append(`<h4 class="card-title">${category}</h4>`);
            const catActions = $('<div>');
            catActions.append(
                $('<button>').addClass('btn btn-sm btn-warning me-2').text('Rename').click(() => renameCategory(category)),
                $('<button>').addClass('btn btn-sm btn-danger').text('Delete').click(() => deleteCategory(category))
            );
            header.append(catActions);
            catBody.append(header);

            // Table
            const table = $('<table>').addClass('table table-striped table-hover table-compact');
            const thead = $('<thead>').append(`
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Specs</th>
                  <th>Image</th>
                  <th>Links</th>
                  <th>Actions</th>
                </tr>
            `);
            table.append(thead);

            const tbody = $('<tbody>');
            const productsToRender = searchTerm ? products : data[category];

            productsToRender.forEach((product, index) => {
                // Find actual index in original array for actions
                const originalIndex = data[category].indexOf(product);

                const linksHtml = Array.isArray(product.links)
                    ? product.links.map(l => `<a href="${l.url}" target="_blank">${l.store}</a>`).join(', ')
                    : 'No links available';

                // Discount Calculation
                let priceDisplay = `${product.currency || ''} ${product.price || ''}`;
                if (product.mrp && product.price && parseFloat(product.mrp) > parseFloat(product.price)) {
                    const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
                    priceDisplay += ` <small class="text-success">(${discount}% off)</small>`;
                    priceDisplay += `<br><small class="text-muted text-decoration-line-through">${product.currency} ${product.mrp}</small>`;
                }

                // Stock Status
                const stockStatus = product.inStock === false
                    ? '<span class="badge bg-danger">Out of Stock</span>'
                    : '<span class="badge bg-success">In Stock</span>';

                // Coupon
                const couponDisplay = product.coupon ? `<br><span class="badge bg-info text-dark">Code: ${product.coupon}</span>` : '';

                const row = $('<tr>').append(`
                    <td>${product.name} ${stockStatus} ${couponDisplay}</td>
                    <td>${priceDisplay}</td>
                    <td><div class="specs-cell">${product.specs}</div></td>
                    <td>${product.image}</td>
                    <td>${linksHtml}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-2">Edit</button>
                        <button class="btn btn-sm btn-danger">Delete</button>
                    </td>
                `);

                row.find('.btn-primary').click(() => editProduct(category, originalIndex));
                row.find('.btn-danger').click(() => deleteProduct(category, originalIndex));
                tbody.append(row);
            });

            table.append(tbody);
            const addBtn = $('<button>').addClass('btn btn-success mt-2').text('Add Product').click(() => addProduct(category));
            catBody.append(table, addBtn);
            catCard.append(catBody);
            categoriesDiv.append(catCard);
        }
    }

    // -------------------- Product Modal --------------------
    let currentCategory = null;
    let currentIndex = null;
    let isEdit = false;
    const productModal = new bootstrap.Modal(document.getElementById('productModal'));

    function openProductModal(category, index = null) {
        currentCategory = category;
        currentIndex = index;
        isEdit = index !== null;
        $('#modalTitle').text(isEdit ? 'Edit Product' : 'Add Product');

        $('#productForm')[0].reset();
        $('#linksContainer').empty();
        $('#imagePreviewContainer').empty();
        resetQuill();

        if (isEdit) {
            const product = data[category][index];
            $('#prodName').val(product.name);
            $('#prodPrice').val(product.price);
            $('#prodCurrency').val(product.currency);
            $('#prodMRP').val(product.mrp || '');
            $('#prodCoupon').val(product.coupon || '');
            $('#prodInStock').prop('checked', product.inStock !== false); // Default to true if undefined
            quill.root.innerHTML = product.specs || "";

            if (Array.isArray(product.image)) {
                product.image.forEach(id => {
                    firebaseOps.readBase64Image(id, function (base64String) {
                        $('#imagePreviewContainer').append(
                            `<img src="${base64String}" class="img-thumbnail me-2" style="max-width:100px;">`
                        );
                    });
                });
            }

            if (Array.isArray(product.links)) {
                product.links.forEach(l => addLinkField(l.store, l.url));
            }
        }

        productModal.show();
    }

    function addLinkField(store = "Amazon", url = "") {
        const row = $('<div>').addClass('input-group mb-2');

        const storeSelect = $('<select>').addClass('form-select').css('max-width', '150px');
        const stores = ["Amazon", "Flipkart"];
        stores.forEach(s => {
            const option = $('<option>').val(s).text(s);
            if (s === store) option.prop('selected', true);
            storeSelect.append(option);
        });

        const urlInput = $('<input>').attr({ type: "url", placeholder: "URL" }).addClass('form-control').val(url);
        const removeBtn = $('<button>').addClass('btn btn-outline-danger').text('Remove').click(() => row.remove());
        row.append(storeSelect, urlInput, removeBtn);
        $('#linksContainer').append(row);
    }

    $('#addLinkBtn').on('click', () => addLinkField());

    // -------------------- Image Compression --------------------
    function compressImage(file, maxSizeKB = 128, callback) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                let width = img.width;
                let height = img.height;

                const scaleFactor = Math.sqrt((maxSizeKB * 1024) / file.size);
                if (scaleFactor < 1) {
                    width = Math.floor(width * scaleFactor);
                    height = Math.floor(height * scaleFactor);
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.9;
                let base64String;
                do {
                    base64String = canvas.toDataURL("image/jpeg", quality);
                    quality -= 0.1;
                } while (base64String.length / 1024 > maxSizeKB && quality > 0.1);

                callback(base64String);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // -------------------- Product Form Submit --------------------
    $('#productForm').on('submit', function (e) {
        e.preventDefault();
        const name = $('#prodName').val();
        const price = $('#prodPrice').val();
        const currency = $('#prodCurrency').val();
        const mrp = $('#prodMRP').val();
        const coupon = $('#prodCoupon').val();
        const inStock = $('#prodInStock').is(':checked');
        const specs = quill.root.innerHTML;
        const files = $('#prodImage')[0].files;

        const links = [];
        $('#linksContainer .input-group').each(function () {
            const store = $(this).find('select').val();
            const url = $(this).find('input[type="url"]').val().trim();
            if (store && url) links.push({ store, url });
        });

        const productData = { name, price, currency, mrp, coupon, inStock, specs, links, image: [] };

        const saveProduct = () => {
            if (isEdit) {
                data[currentCategory][currentIndex] = productData;
            } else {
                data[currentCategory].push(productData);
            }
            saveLocal();
            productModal.hide();
            render();
        };

        if (files.length > 0) {
            const promises = Array.from(files).map((file, index) => {
                return new Promise((resolve) => {
                    compressImage(file, 1024, function (base64String) {
                        const imageId = Date.now() + "_" + index;
                        firebaseOps.saveBase64Image(imageId, base64String, () => {
                            productData.image.push(imageId);
                            resolve();
                        });
                    });
                });
            });

            Promise.all(promises).then(saveProduct);
        } else {
            saveProduct();
        }
    });

    // -------------------- Product Actions --------------------
    const addProduct = (category) => openProductModal(category);
    const editProduct = (category, index) => openProductModal(category, index);
    const deleteProduct = (category, index) => {
        if (confirm("Delete this product?")) {
            data[category].splice(index, 1);
            saveLocal();
            render();
        }
    };

    // -------------------- Category Modal --------------------
    let isCategoryEdit = false;
    let currentCategoryName = null;
    const categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));

    $('#addCategoryBtn').on('click', () => {
        $('#categoryForm')[0].reset();
        $('#categoryModal .modal-title').text('Add Category');
        isCategoryEdit = false;
        currentCategoryName = null;
        categoryModal.show();
    });

    function renameCategory(category) {
        $('#categoryForm')[0].reset();
        $('#catName').val(category);
        $('#categoryModal .modal-title').text('Rename Category');
        isCategoryEdit = true;
        currentCategoryName = category;
        categoryModal.show();
    }

    $('#categoryForm').on('submit', function (e) {
        e.preventDefault();
        const name = $('#catName').val().trim();
        if (!name) return;
        if (isCategoryEdit) {
            if (name === currentCategoryName) {
                categoryModal.hide();
                return;
            }
            if (data[name]) {
                alert("Category already exists!");
                return;
            }

            const newData = {};
            newData[name] = data[currentCategoryName];
            for (let key in data) {
                if (key !== currentCategoryName) newData[key] = data[key];
            }
            data = newData;
        } else {
            if (data[name]) {
                alert("Category already exists!");
                return;
            }

            data[name] = [];
        }

        saveLocal();
        render();
        categoryModal.hide();
    });

    function deleteCategory(category) {
        if (confirm(`Delete category "${category}" and all its products?`)) {
            delete data[category];
            saveLocal();
            render();
        }
    }

    // -------------------- Reset Data --------------------
    $('#resetDataBtn').on('click', function () {
        if (confirm("Reload data from Firebase? All unsaved local changes will be lost.")) {
            firebaseOps.readData("products", function (snapshotData) {
                if (snapshotData) {
                    data = snapshotData;
                    saveLocal();
                    render();
                    alert("Data refreshed from Firebase.");
                } else {
                    alert("No data found in Firebase.");
                }
            });
        }
    });

    // -------------------- Initial Load --------------------
    firebaseOps.readData("products", function (snapshotData) {
        if (snapshotData) {
            data = snapshotData;
            saveLocal();
            render();
        } else if (loadLocal()) {
            render();
        } else {
            data = {};
            saveLocal();
            render();
        }
    });

    // -------------------- JSON Save --------------------
    $('#saveJsonBtn').on('click', function () {
        try {
            const edited = JSON.parse($('#jsonEditor').val());
            localStorage.setItem('adminData', JSON.stringify(edited));
            data = edited;
            render();
            firebaseOps.writeData("products", edited);
            alert('JSON saved successfully to Firebase!');
        } catch (e) {
            alert('Invalid JSON format. Please fix errors before saving.');
        }
    });

    // -------------------- Review Mode --------------------
    $('#reviewBtn').on('click', function () {
        $('#adminView').hide();
        $('#reviewView').show();
        const stored = localStorage.getItem('adminData');
        $('#jsonEditor').val(stored ? JSON.stringify(JSON.parse(stored), null, 2) : '// No JSON found in localStorage');
    });

    $('#closeReviewBtn').on('click', function () {
        $('#reviewView').hide();
        $('#adminView').show();
    });

    // -------------------- Search Event --------------------
    searchInput.on('input', render);

});
