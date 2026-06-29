      const goldId = rid('featured_product_list');
      sections[goldId] = {
        type: 'featured-product-list',
        blocks: {
          'section-header': {
            type: '_section-header',
            static: true,
            settings: {
              subheading: 'THE GOLD CHAPTER',
              title: 'Reserved for the few',
              content: '<p>Four pieces. Carefully chosen. Where gold is not an accessory — it is the language.</p>',
              button_text: '',
              button_link: '',
              button_style: 'outline',
              text_alignment: 'center',
              heading_size: 'h3',
              title_icon: 'none',
              show_scrolling_title: false,
            },
            blocks: {},
          },
        },
        block_order: [],
        settings: {
          color_scheme: 'scheme-1',
          product_list: GOLD_CHAPTER,
          stack_products_mobile: false,
          stack_products_desktop: true,
          products_per_row_mobile: '2',
          products_per_row_desktop: 4,
          show_view_all_button: false,
        },
      };
      order.push(goldId);
