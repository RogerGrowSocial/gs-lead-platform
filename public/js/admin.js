$(document).ready(function() {
    // Sidebar toggle
    $('#sidebarToggle').click(function() {
      $('body').toggleClass('sidebar-collapsed');
      
      // Verander het icoon
      if ($('body').hasClass('sidebar-collapsed')) {
        $(this).find('i').removeClass('fa-chevron-left').addClass('fa-chevron-right');
      } else {
        $(this).find('i').removeClass('fa-chevron-right').addClass('fa-chevron-left');
      }
    });
    
    // Mobiele sidebar toggle
    $('.navbar-toggler').click(function() {
      $('body').toggleClass('sidebar-open');
    });
    
    // Sluit sidebar bij klikken buiten sidebar op mobiel
    $(document).on('click', function(e) {
      if ($(window).width() <= 767.98) {
        if (!$(e.target).closest('.main-sidebar').length && 
            !$(e.target).closest('.navbar-toggler').length && 
            $('body').hasClass('sidebar-open')) {
          $('body').removeClass('sidebar-open');
        }
      }
    });
    
    // DataTables initialisatie
    if ($.fn.DataTable) {
      $('.datatable').DataTable({
        "language": {
          "url": "//cdn.datatables.net/plug-ins/1.10.24/i18n/Dutch.json"
        },
        "responsive": true,
        "autoWidth": false
      });
    }
    
    // Tooltip initialisatie
    $('[data-toggle="tooltip"]').tooltip();
    
    // Bevestiging voor verwijderen
    $('.delete-confirm').click(function(e) {
      if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) {
        e.preventDefault();
      }
    });
    
    // Formulier validatie
    if ($.fn.validate) {
      $('.needs-validation').validate({
        errorElement: 'span',
        errorPlacement: function(error, element) {
          error.addClass('invalid-feedback');
          element.closest('.form-group').append(error);
        },
        highlight: function(element, errorClass, validClass) {
          $(element).addClass('is-invalid');
        },
        unhighlight: function(element, errorClass, validClass) {
          $(element).removeClass('is-invalid');
        }
      });
    }
  });