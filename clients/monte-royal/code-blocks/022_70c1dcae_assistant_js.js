      const goldId = rid('featured_product_list');
      sections[goldId] = {
        type: 'featured-product-list',
        blocks: {},
        block_order: [],
        settings: {
          color_scheme: 'scheme-1',
          product_list: GOLD_CHAPTER,
          intro_title: 'THE GOLD CHAPTER',
          intro_title_tag: 'h6',
          intro_content: '<p>Four pieces. Carefully chosen. Where gold is not an accessory — it is the language.</p>',
          intro_button_text: '',
          intro_button_link: '',
          intro_button_style: 'outline',
          intro_color_scheme: 'scheme-7',
          stack_products_mobile: false,
          stack_products_desktop: true,
          products_per_row_mobile: '2',
          products_per_row_desktop: 4,
          show_view_all_button: false,
        },
      };
      order.push(goldId);
