/**
 * ArbaConnect ERP - Application Coordinator & Main Controller
 * Fully connects layout shell, search dropdown, notifications, modals, toasts,
 * and view lifecycle to window.ArbaStore.
 */

(function () {
  'use strict';

  window.ArbaApp = {
    init: function () {
      this.initTheme();
      this.bindHeader();
      this.bindSidebar();
      this.bindGlobalKeyboard();
      this.subscribeStore();
      this.render();
      if (window.ArbaOfflineSync && typeof window.ArbaOfflineSync.init === 'function') {
        window.ArbaOfflineSync.init();
      }
      if (window.ArbaAuth && typeof window.ArbaAuth.init === 'function') {
        window.ArbaAuth.init();
      }
    },

    initTheme: function () {
      var state = window.ArbaStore.getState();
      if (state.isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },

    toggleFullscreen: function () {
      var self = this;
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().then(function () {
            self.showToast('Mode Layar Penuh diaktifkan (Tekan ESC untuk keluar)', 'fullscreen');
          }).catch(function (err) {
            console.warn('Fullscreen request failed:', err);
          });
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().then(function () {
            self.showToast('Keluar dari mode layar penuh', 'fullscreen_exit');
          });
        }
      }
    },

    updateFullscreenIcon: function () {
      var fullscreenIcon = document.getElementById('header-fullscreen-icon');
      var fullscreenBtn = document.getElementById('header-fullscreen-btn');
      if (!fullscreenIcon) return;
      if (document.fullscreenElement) {
        fullscreenIcon.textContent = 'fullscreen_exit';
        if (fullscreenBtn) fullscreenBtn.setAttribute('title', 'Keluar Layar Penuh (ESC)');
      } else {
        fullscreenIcon.textContent = 'fullscreen';
        if (fullscreenBtn) fullscreenBtn.setAttribute('title', 'Mode Layar Penuh (Kiosk / F11)');
      }
    },

    subscribeStore: function () {
      var self = this;
      window.ArbaStore.subscribe(function (state) {
        self.updateHeaderControls(state);
        self.updateSidebarBadges(state);
        self.renderCurrentView();
      });
    },

    navigate: function (path) {
      window.ArbaStore.setPath(path);
    },

    render: function () {
      var state = window.ArbaStore.getState();
      this.updateHeaderControls(state);
      this.updateSidebarBadges(state);
      this.renderCurrentView();
    },

    renderCurrentView: function () {
      var state = window.ArbaStore.getState();
      var container = document.getElementById('main-view-container');
      if (!container) return;

      if (window.ArbaAuth && typeof window.ArbaAuth.updateAppShellVisibility === 'function') {
        window.ArbaAuth.updateAppShellVisibility();
      }

      // Jika belum ada user yang login, tampilkan khusus halaman Login dan jangan render halaman internal
      if (!state.currentUser) {
        container.innerHTML = '';
        if (window.ArbaAuth && typeof window.ArbaAuth.showLoginPortal === 'function') {
          window.ArbaAuth.showLoginPortal();
        }
        return;
      }

      // Strict Role-Based Access Control (RBAC): Hanya tampilkan halaman yang diizinkan untuk user aktif
      var allowedPaths = window.ArbaStore.getAllowedPathsForUser(state.currentUser);

      if (allowedPaths.indexOf(state.currentPath) === -1) {
        var fallback = (state.currentUser.defaultPath && allowedPaths.indexOf(state.currentUser.defaultPath) !== -1)
          ? state.currentUser.defaultPath
          : allowedPaths[0];
        state.currentPath = fallback || 'user-profile-settings';
      }

      var navButtons = document.querySelectorAll('.nav-button');
      navButtons.forEach(function (btn) {
        var path = btn.getAttribute('data-path');
        var isAllowed = allowedPaths.indexOf(path) !== -1;
        btn.style.display = isAllowed ? '' : 'none';
        if (path === state.currentPath) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Render view module
      switch (state.currentPath) {
        case 'executive-dashboard':
          if (window.ArbaViews.renderExecutiveDashboard) {
            window.ArbaViews.renderExecutiveDashboard(container);
          }
          break;
        case 'inventory-stock-ledger':
          if (window.ArbaViews.renderInventoryLedger) {
            window.ArbaViews.renderInventoryLedger(container);
          }
          break;
        case 'b2b-crm-directory':
          if (window.ArbaViews.renderB2bCrm) {
            window.ArbaViews.renderB2bCrm(container);
          }
          break;
        case 'order-approval-queue':
          if (window.ArbaViews.renderOrderApproval) {
            window.ArbaViews.renderOrderApproval(container);
          }
          break;
        case 'field-sales-pwa-preview':
          if (window.ArbaViews.renderFieldSalesPwa) {
            window.ArbaViews.renderFieldSalesPwa(container);
          }
          break;
        case 'user-management':
          if (window.ArbaViews.renderUserManagement) {
            window.ArbaViews.renderUserManagement(container);
          }
          break;
        case 'user-profile-settings':
          if (window.ArbaViews.renderUserProfileSettings) {
            window.ArbaViews.renderUserProfileSettings(container);
          }
          break;
        default:
          if (window.ArbaViews.renderUserProfileSettings) {
            window.ArbaViews.renderUserProfileSettings(container);
          }
          break;
      }

      window.scrollTo(0, 0);
    },

    // Header interaction handling
    bindHeader: function () {
      var self = this;

      // Brand Logo click -> Navigate to user's default permitted page
      var brand = document.getElementById('header-brand-logo');
      if (brand) {
        brand.addEventListener('click', function () {
          var st = window.ArbaStore.getState();
          var allowed = window.ArbaStore.getAllowedPathsForUser(st.currentUser);
          var target = (st.currentUser && st.currentUser.defaultPath && allowed.indexOf(st.currentUser.defaultPath) !== -1)
            ? st.currentUser.defaultPath
            : (allowed[0] || 'user-profile-settings');
          self.navigate(target);
        });
      }

      // Quick Search input & live dropdown
      var searchInput = document.getElementById('global-search-input');
      var searchDropdown = document.getElementById('global-search-dropdown');
      var clearBtn = document.getElementById('search-clear-btn');

      if (searchInput && searchDropdown) {
        searchInput.addEventListener('input', function (e) {
          var q = e.target.value.trim().toLowerCase();
          if (!q) {
            searchDropdown.classList.add('hidden');
            if (clearBtn) clearBtn.classList.add('hidden');
            return;
          }

          if (clearBtn) clearBtn.classList.remove('hidden');
          self.renderSearchDropdown(q, searchDropdown, searchInput);
        });

        searchInput.addEventListener('focus', function (e) {
          var q = e.target.value.trim().toLowerCase();
          if (q) {
            self.renderSearchDropdown(q, searchDropdown, searchInput);
          }
        });

        if (clearBtn) {
          clearBtn.addEventListener('click', function () {
            searchInput.value = '';
            searchDropdown.classList.add('hidden');
            clearBtn.classList.add('hidden');
            searchInput.focus();
          });
        }

        // Close search dropdown on click outside
        document.addEventListener('click', function (e) {
          if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.classList.add('hidden');
          }
        });
      }

      // Role switcher dropdown
      var roleSelect = document.getElementById('role-perspective-select');
      if (roleSelect) {
        roleSelect.addEventListener('change', function (e) {
          var newRole = e.target.value;
          window.ArbaStore.setRole(newRole);
        });
      }

      // Online status toggle button
      var onlineBtn = document.getElementById('header-online-btn');
      if (onlineBtn) {
        onlineBtn.addEventListener('click', function () {
          window.ArbaStore.toggleOnlineStatus();
        });
      }

      // Install PWA button
      var installBtn = document.getElementById('header-install-pwa-btn');
      if (installBtn) {
        installBtn.addEventListener('click', function () {
          if (window.ArbaOfflineSync && typeof window.ArbaOfflineSync.promptInstallPWA === 'function') {
            window.ArbaOfflineSync.promptInstallPWA();
          }
        });
      }

      // Fullscreen mode toggle button
      var fullscreenBtn = document.getElementById('header-fullscreen-btn');
      if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function () {
          self.toggleFullscreen();
        });
        document.addEventListener('fullscreenchange', function () {
          self.updateFullscreenIcon();
        });
      }

      // Dark mode toggle button
      var darkBtn = document.getElementById('header-dark-btn');
      if (darkBtn) {
        darkBtn.addEventListener('click', function () {
          window.ArbaStore.toggleDarkMode();
          self.initTheme();
        });
      }

      // Notifications toggle & menu
      var notifBtn = document.getElementById('header-notif-btn');
      var notifMenu = document.getElementById('header-notif-menu');
      if (notifBtn && notifMenu) {
        notifBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          notifMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', function (e) {
          if (!notifBtn.contains(e.target) && !notifMenu.contains(e.target)) {
            notifMenu.classList.add('hidden');
          }
        });

        // Notifications item links
        var notifOrder = document.getElementById('notif-item-order');
        if (notifOrder) {
          notifOrder.addEventListener('click', function () {
            self.navigate('order-approval-queue');
            notifMenu.classList.add('hidden');
          });
        }

        var notifRop = document.getElementById('notif-item-rop');
        if (notifRop) {
          notifRop.addEventListener('click', function () {
            self.navigate('inventory-stock-ledger');
            notifMenu.classList.add('hidden');
          });
        }

        var notifCdob = document.getElementById('notif-item-cdob');
        if (notifCdob) {
          notifCdob.addEventListener('click', function () {
            self.showToast('Audit Kepatuhan CDOB: 99.4% Kepatuhan FEFO tervalidasi!', 'verified');
            notifMenu.classList.add('hidden');
          });
        }
      }

      // User profile pill click -> Open RBAC Profile & Account Switcher Modal
      var profilePill = document.getElementById('header-profile-pill');
      if (profilePill) {
        profilePill.addEventListener('click', function () {
          if (window.ArbaAuth && typeof window.ArbaAuth.openProfileModal === 'function') {
            window.ArbaAuth.openProfileModal();
          } else {
            var role = window.ArbaStore.getState().currentRole;
            self.showToast(`Login sebagai: ${role.toUpperCase()} (CV Arba'in Logistik)`, 'account_circle');
          }
        });
      }

      // Header Logout / Switch Role button -> Open Full Login Portal
      var logoutBtn = document.getElementById('header-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          if (window.ArbaAuth && typeof window.ArbaAuth.showLoginPortal === 'function') {
            window.ArbaAuth.showLoginPortal();
          }
        });
      }
    },

    renderSearchDropdown: function (query, dropdown, inputElem) {
      var self = this;
      var state = window.ArbaStore.getState();

      var matchedOutlets = state.outlets.filter(function (o) {
        return o.name.toLowerCase().indexOf(query) !== -1 || o.code.toLowerCase().indexOf(query) !== -1;
      }).slice(0, 3);

      var matchedProducts = state.products.filter(function (p) {
        return p.name.toLowerCase().indexOf(query) !== -1 || p.sku.toLowerCase().indexOf(query) !== -1;
      }).slice(0, 3);

      var matchedOrders = state.orders.filter(function (ord) {
        return ord.clientUuid.toLowerCase().indexOf(query) !== -1 || ord.outletName.toLowerCase().indexOf(query) !== -1;
      }).slice(0, 3);

      var hasResults = matchedOutlets.length > 0 || matchedProducts.length > 0 || matchedOrders.length > 0;

      if (!hasResults) {
        dropdown.innerHTML = `
          <div class="p-3 text-center text-xs text-on-surface-variant">
            Tidak ditemukan hasil untuk "${window.ArbaUtils.escapeHtml(query)}"
          </div>
        `;
        dropdown.classList.remove('hidden');
        return;
      }

      var html = '<div class="flex flex-col gap-2 text-xs">';

      if (matchedOutlets.length > 0) {
        html += `
          <div>
            <div class="search-section-title">Mitra B2B Outlet</div>
            ${matchedOutlets.map(function (o) {
              return `
                <div class="search-item search-outlet-item" data-outlet-id="${o.id}">
                  <div class="font-medium text-on-surface">${o.name}</div>
                  <span class="text-[11px] text-on-surface-variant">${o.cityName}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      if (matchedProducts.length > 0) {
        html += `
          <div>
            <div class="search-section-title">Produk &amp; SKU Herbal</div>
            ${matchedProducts.map(function (p) {
              return `
                <div class="search-item search-product-item" data-sku="${p.sku}">
                  <div class="font-medium text-on-surface">${p.name}</div>
                  <span class="text-[11px] font-mono text-primary font-semibold">Stok: ${p.stock}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      if (matchedOrders.length > 0) {
        html += `
          <div>
            <div class="search-section-title">Faktur Pesanan B2B</div>
            ${matchedOrders.map(function (ord) {
              return `
                <div class="search-item search-order-item" data-order-id="${ord.id}">
                  <div>
                    <span class="font-mono font-semibold text-primary">${ord.clientUuid}</span>
                    <span class="ml-2 text-on-surface-variant">${ord.outletName}</span>
                  </div>
                  <span class="font-semibold text-xs text-on-surface">${window.ArbaUtils.formatRupiah(ord.totalAmount)}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      html += '</div>';
      dropdown.innerHTML = html;
      dropdown.classList.remove('hidden');

      // Bind search items click
      dropdown.querySelectorAll('.search-outlet-item').forEach(function (el) {
        el.onclick = function () {
          var oId = el.getAttribute('data-outlet-id');
          window.ArbaStore.setSelectedOutletId(oId);
          self.navigate('b2b-crm-directory');
          dropdown.classList.add('hidden');
          inputElem.value = '';
        };
      });

      dropdown.querySelectorAll('.search-product-item').forEach(function (el) {
        el.onclick = function () {
          self.navigate('inventory-stock-ledger');
          dropdown.classList.add('hidden');
          inputElem.value = '';
        };
      });

      dropdown.querySelectorAll('.search-order-item').forEach(function (el) {
        el.onclick = function () {
          self.navigate('order-approval-queue');
          dropdown.classList.add('hidden');
          inputElem.value = '';
        };
      });
    },

    updateHeaderControls: function (state) {
      // Role switcher wrapper: Hanya ditampilkan untuk Super Admin
      var roleWrapper = document.getElementById('role-switcher-wrapper') || document.querySelector('.role-switcher-container');
      var roleSelect = document.getElementById('role-perspective-select');
      if (roleWrapper) {
        var isSuper = state.currentUser && state.currentUser.role === 'super-admin';
        roleWrapper.style.display = isSuper ? '' : 'none';
      }
      if (roleSelect && roleSelect.value !== state.currentRole) {
        roleSelect.value = state.currentRole;
      }
      var profilePill = document.getElementById('header-profile-pill');
      var profileAvatar = document.getElementById('header-profile-avatar');
      if (profilePill) {
        var roleLabelMap = {
          'super-admin': ['Farid Super Administrator', 'Super Admin & RBAC Manager'],
          'executive': ['H. Ahmad Zaini, S.E.', 'Direktur & Manajemen (6 Pilar)'],
          'inventory': ['Slamet Riadi', 'Kepala Gudang & Stok FEFO'],
          'sales-ops': ['Dewi Sartika, S.Ak.', 'Koordinator Admin Penjualan'],
          'field-sales': [state.currentSalesRep || 'Budi Santoso', 'Sales Lapangan (Mobile PWA)']
        };
        var labels = state.currentUser
          ? [state.currentUser.name, state.currentUser.title]
          : (roleLabelMap[state.currentRole] || roleLabelMap['executive']);
        var spans = profilePill.querySelectorAll('span.text-xs, span.text-\\[11px\\]');
        if (spans.length >= 2) {
          spans[0].textContent = labels[0];
          spans[1].textContent = labels[1];
        }
        if (profileAvatar) {
          var initials = (state.currentUser && state.currentUser.avatarInitials) ||
            labels[0].split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
          profileAvatar.textContent = initials;
          if (state.currentUser && state.currentUser.badgeColor) {
            profileAvatar.style.backgroundColor = state.currentUser.badgeColor;
            profileAvatar.style.color = '#ffffff';
          }
        }
      }

      // Online status indicator
      var statusDot = document.getElementById('header-online-dot');
      var statusText = document.getElementById('header-online-text');
      if (statusDot && statusText) {
        var qLen = (state.offlineQueue && state.offlineQueue.length) || 0;
        if (state.isOnline) {
          statusDot.className = 'status-dot online';
          statusText.textContent = 'Tersinkron';
        } else {
          statusDot.className = 'status-dot offline';
          statusText.textContent = qLen > 0 ? 'Mode Lokal (' + qLen + ')' : 'Mode Lokal';
        }
      }

      // Dark mode icon
      var darkIcon = document.getElementById('header-dark-icon');
      if (darkIcon) {
        darkIcon.textContent = state.isDarkMode ? 'light_mode' : 'dark_mode';
      }

      // Notification badge
      var pendingCount = state.orders.filter(function (o) { return o.status === 'PENDING'; }).length;
      var notifBadge = document.getElementById('header-notif-badge');
      var notifCountLabel = document.getElementById('notif-pending-count-label');

      if (notifBadge) {
        if (pendingCount > 0) {
          notifBadge.classList.remove('hidden');
        } else {
          notifBadge.classList.add('hidden');
        }
      }
      if (notifCountLabel) {
        notifCountLabel.textContent = `${pendingCount} Pesanan Baru`;
      }
    },

    // Sidebar interaction handling
    bindSidebar: function () {
      var self = this;
      var sidebar = document.getElementById('app-sidebar');
      var backdrop = document.getElementById('sidebar-backdrop');
      var toggleBtn = document.getElementById('sidebar-toggle-btn');
      var navButtons = document.querySelectorAll('.nav-button');

      // Nav item clicks
      navButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var path = btn.getAttribute('data-path');
          self.navigate(path);
          if (window.innerWidth < 1024) {
            var st = window.ArbaStore.getState();
            if (!st.isSidebarCollapsed) {
              window.ArbaStore.toggleSidebar();
            }
          }
        });
      });

      // Fold / Unfold Button
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          window.ArbaStore.toggleSidebar();
        });
      }

      // Backdrop click folds sidebar
      if (backdrop) {
        backdrop.addEventListener('click', function () {
          window.ArbaStore.toggleSidebar();
        });
      }
    },

    updateSidebarBadges: function (state) {
      var sidebar = document.getElementById('app-sidebar');
      var backdrop = document.getElementById('sidebar-backdrop');
      var toggleBtn = document.getElementById('sidebar-toggle-btn');
      var contentWrapper = document.getElementById('app-content-wrapper') || document.querySelector('.app-content-wrapper');

      if (sidebar && toggleBtn) {
        if (state.isSidebarCollapsed) {
          sidebar.classList.remove('expanded');
          sidebar.classList.add('collapsed');
          if (backdrop) backdrop.classList.add('hidden');
          if (contentWrapper) contentWrapper.classList.remove('sidebar-open');
          toggleBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">chevron_right</span>';
          toggleBtn.title = 'Buka Menu Samping';
        } else {
          sidebar.classList.remove('collapsed');
          sidebar.classList.add('expanded');
          if (backdrop) backdrop.classList.remove('hidden');
          if (contentWrapper) contentWrapper.classList.add('sidebar-open');
          toggleBtn.innerHTML = `
            <span class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px]">dock_to_left</span>
              <span>Lipat Menu</span>
            </span>
            <span class="material-symbols-outlined text-[16px]">chevron_left</span>
          `;
          toggleBtn.title = 'Lipat Menu Samping';
        }
      }

      // Update badge counts
      var pendingCount = state.orders.filter(function (o) { return o.status === 'PENDING'; }).length;
      var criticalStockCount = state.products.filter(function (p) {
        return p.status === 'below-rop' || p.status === 'critical-expiry';
      }).length;

      var invBadge = document.getElementById('badge-inventory');
      var ordBadge = document.getElementById('badge-orders');

      if (invBadge) {
        if (criticalStockCount > 0) {
          invBadge.textContent = criticalStockCount;
          invBadge.classList.remove('hidden');
        } else {
          invBadge.classList.add('hidden');
        }
      }

      if (ordBadge) {
        if (pendingCount > 0) {
          ordBadge.textContent = pendingCount;
          ordBadge.classList.remove('hidden');
        } else {
          ordBadge.classList.add('hidden');
        }
      }
    },

    bindGlobalKeyboard: function () {
      var self = this;
      document.addEventListener('keydown', function (e) {
        // Press Escape to close modal or search dropdown
        if (e.key === 'Escape') {
          self.closeModal();
          var sDrop = document.getElementById('global-search-dropdown');
          if (sDrop) sDrop.classList.add('hidden');
        }
      });

      // Browser forward/backward navigation via hashchange
      window.addEventListener('hashchange', function () {
        var h = window.location.hash.replace(/^#\/?/, '');
        if (h === 'login') {
          if (window.ArbaAuth && typeof window.ArbaAuth.showLoginPortal === 'function') {
            window.ArbaAuth.showLoginPortal();
          }
          return;
        }
        var validPaths = [
          'executive-dashboard',
          'inventory-stock-ledger',
          'b2b-crm-directory',
          'order-approval-queue',
          'field-sales-pwa-preview',
          'user-management',
          'user-profile-settings'
        ];
        if (h && validPaths.indexOf(h) !== -1) {
          if (h !== window.ArbaStore.getState().currentPath) {
            window.ArbaStore.setPath(h);
          }
        }
      });
    },

    // Modal Manager
    openModal: function (html) {
      var container = document.getElementById('modal-container');
      if (!container) return;

      container.innerHTML = `
        <div class="modal-overlay" id="active-modal-overlay">
          ${html}
        </div>
      `;

      var overlay = document.getElementById('active-modal-overlay');
      if (overlay) {
        overlay.onclick = function (e) {
          if (e.target === overlay) {
            window.ArbaApp.closeModal();
          }
        };
      }
    },

    closeModal: function () {
      var container = document.getElementById('modal-container');
      if (container) {
        container.innerHTML = '';
      }
    },

    // Toast Manager
    showToast: function (message, icon) {
      var toastContainer = document.getElementById('toast-container');
      if (!toastContainer) return;

      var iconName = icon || 'check_circle';
      toastContainer.innerHTML = `
        <div class="toast-popup">
          <span class="material-symbols-outlined text-[22px] text-emerald-400" style="color: #22c55e;">
            ${iconName}
          </span>
          <span class="font-medium text-xs">${message}</span>
        </div>
      `;

      if (this._toastTimer) {
        clearTimeout(this._toastTimer);
      }

      this._toastTimer = setTimeout(function () {
        toastContainer.innerHTML = '';
      }, 3200);
    }
  };

  // Launch on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    window.ArbaApp.init();
  });
})();
